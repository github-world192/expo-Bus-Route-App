import json
import math
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup


@dataclass
class BusArrival:
    """Represents a bus arrival estimate."""
    route: str
    direction: str
    estimated_time: str
    raw_time_value: str
    stop_dynamic_id: str


class TaipeiBusAPI:
    """Client for fetching Taipei bus arrival estimates."""
    
    BASE_URL = "https://pda5284.gov.taipei/MQS"
    
    # Status code mappings from the API
    STATUS_CODES = {
        '0': '進站中',
        '': '未發車',
        '-1': '未發車',
        '-2': '交管不停',
        '-3': '末班已過',
        '-4': '今日未營運'
    }
    
    def __init__(self, stop_mapping_file: str = "stop_to_slid.json"):
        """Initialize with stop name to ID mapping file."""
        self.stop_mapping = self._load_stop_mapping(stop_mapping_file)
    
    @staticmethod
    def _load_stop_mapping(filepath: str) -> Dict[str, str]:
        """Load stop name to stop location ID mapping."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Stop mapping file not found: {filepath}")
    
    def get_stop_estimates(self, stop_name: str) -> Tuple[List[BusArrival], str]:
        """
        Get bus arrival estimates for a specific stop.
        
        Args:
            stop_name: Name of the bus stop
            
        Returns:
            Tuple of (list of BusArrival objects, last update time)
        """
        stop_id = self.stop_mapping.get(stop_name)
        if not stop_id:
            return [], ""
        
        # Fetch static route information
        route_map = self._fetch_route_info(stop_id)
        
        # Fetch dynamic arrival data
        dynamic_data = self._fetch_dynamic_data(stop_id)
        
        # Process and combine the data
        return self._process_arrivals(dynamic_data, route_map)
    
    def _fetch_route_info(self, stop_id: str) -> Dict[str, Dict[str, str]]:
        """Fetch static route information for a stop."""
        url = f"{self.BASE_URL}/stoplocation.jsp?slid={stop_id}"
        response = requests.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        bus_rows = soup.find_all('tr', class_=['ttego1', 'ttego2'])
        
        route_map = {}
        for row in bus_rows:
            cols = row.find_all('td')
            if len(cols) != 4:
                continue
            
            route_name = self._extract_text(cols[0], 'a')
            stop_name = self._extract_text(cols[1], 'a')
            direction = cols[2].text.strip()
            
            time_td = cols[3]
            if time_td and time_td.get('id'):
                dynamic_id = time_td.get('id').replace('tte', '')
                route_map[dynamic_id] = {
                    "路線": route_name,
                    "站牌": stop_name,
                    "去返程": direction
                }
        
        return route_map
    
    def _fetch_dynamic_data(self, stop_id: str) -> dict:
        """Fetch dynamic arrival data for a stop."""
        url = f"{self.BASE_URL}/StopLocationDyna?stoplocationid={stop_id}"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    
    def _process_arrivals(
        self, 
        json_data: dict, 
        route_map: Dict[str, Dict[str, str]]
    ) -> Tuple[List[BusArrival], str]:
        """Process dynamic data and combine with route information."""
        arrivals = []
        update_time = json_data.get("UpdateTime", "N/A").replace('&#x3a;', ':')
        
        for stop_entry in json_data.get("Stop", []):
            if "n1" not in stop_entry:
                continue
            
            n1_parts = stop_entry["n1"].split(',')
            if len(n1_parts) < 8:
                continue
            
            stop_dynamic_id = n1_parts[1]
            raw_time = n1_parts[7]
            estimated_time = self._format_arrival_time(raw_time)
            
            # Get static route info, with fallback
            static_info = route_map.get(
                str(stop_entry['id']), 
                {"路線": f"未知路線 (ID:{stop_dynamic_id})", "去返程": "N/A"}
            )
            
            arrivals.append(BusArrival(
                route=static_info['路線'],
                direction=static_info['去返程'],
                estimated_time=estimated_time,
                raw_time_value=raw_time,
                stop_dynamic_id=stop_dynamic_id
            ))
        
        # Sort by route name for easier reading
        arrivals.sort(key=lambda x: x.route)
        
        return arrivals, update_time
    
    def _format_arrival_time(self, time_value: str) -> str:
        """Convert arrival time seconds to human-readable format."""
        # Check for special status codes
        if time_value in self.STATUS_CODES:
            return self.STATUS_CODES[time_value]
        
        try:
            seconds = int(time_value)
            
            if seconds == 0:
                return "進站中"
            elif 0 < seconds < 180:
                return "將到站"
            elif seconds >= 180:
                return f"{math.floor(seconds / 60)}分"
            else:
                return self.STATUS_CODES.get(str(seconds), "數據異常")
                
        except ValueError:
            return "資料格式錯誤"
    
    @staticmethod
    def _extract_text(td_element, tag: str, default: str = "N/A") -> str:
        """Extract text from a td element's child tag."""
        child = td_element.find(tag)
        return child.text.strip() if child else default


def main():
    """Example usage."""
    api = TaipeiBusAPI()
    arrivals, last_update = api.get_stop_estimates("捷運公館站")
    
    print(f"最後更新時間: {last_update}\n")
    
    for arrival in arrivals:
        print(f"路線: {arrival.route}")
        print(f"去返程: {arrival.direction}")
        print(f"預估到站: {arrival.estimated_time}")
        print(f"原始值: {arrival.raw_time_value}")
        print("-" * 40)


if __name__ == "__main__":
    main()