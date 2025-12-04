# Taipei Bus API Documentation

Comprehensive documentation for the Taipei Bus Arrival Time API client libraries in Python and React Native (TypeScript).

---

## Table of Contents

- [Overview](#overview)
- [Python Version](#python-version)
  - [Installation](#python-installation)
  - [Quick Start](#python-quick-start)
  - [API Reference](#python-api-reference)
  - [Examples](#python-examples)
- [React Native Version](#react-native-version)
  - [Installation](#react-native-installation)
  - [Quick Start](#react-native-quick-start)
  - [API Reference](#react-native-api-reference)
  - [Examples](#react-native-examples)
- [Data Structures](#data-structures)
- [Error Handling](#error-handling)
- [Status Codes](#status-codes)

---

## Overview

The Taipei Bus API provides a clean, object-oriented interface to fetch real-time bus arrival estimates from Taipei's public transportation system. It handles:

- Fetching static route information
- Retrieving dynamic arrival times
- Parsing HTML and JSON responses
- Converting raw time data to human-readable formats

Both Python and React Native versions maintain the same architecture and API design for consistency.

---

## Python Version

### Python Installation

#### Requirements

- Python 3.7+
- Required packages:

```bash
pip install -r requirements.txt
```

#### Project Setup

1. Save the `TaipeiBusAPI` class to a file (e.g., `taipei_bus.py`)
2. Ensure you have a `stop_to_slid.json` file with stop name to ID mappings:

```json
{
  "捷運公館站": "12345",
  "師大分部": "67890"
}
```

### Python Quick Start

```python
from taipei_bus import TaipeiBusAPI

# Initialize the API client
api = TaipeiBusAPI()

# Get arrival estimates for a stop
arrivals, last_update = api.get_stop_estimates("捷運公館站")

# Display results
print(f"Last Update: {last_update}\n")
for arrival in arrivals:
    print(f"Route: {arrival.route}")
    print(f"Direction: {arrival.direction}")
    print(f"Estimated Time: {arrival.estimated_time}")
    print("-" * 40)
```

### Python API Reference

#### Class: `TaipeiBusAPI`

Main client class for interacting with the Taipei Bus API.

##### Constructor

```python
TaipeiBusAPI(stop_mapping_file: str = "stop_to_slid.json")
```

**Parameters:**
- `stop_mapping_file` (str, optional): Path to JSON file containing stop name to ID mappings. Defaults to "stop_to_slid.json"

**Raises:**
- `FileNotFoundError`: If the mapping file doesn't exist

##### Methods

###### `get_stop_estimates(stop_name: str) -> Tuple[List[BusArrival], str]`

Get bus arrival estimates for a specific stop.

**Parameters:**
- `stop_name` (str): Name of the bus stop (must exist in stop mapping)

**Returns:**
- `Tuple[List[BusArrival], str]`: A tuple containing:
  - List of `BusArrival` objects
  - Last update time as a string

**Example:**
```python
arrivals, update_time = api.get_stop_estimates("捷運公館站")
```

#### Class: `BusArrival`

Dataclass representing a single bus arrival estimate.

**Attributes:**
- `route` (str): Bus route name/number
- `direction` (str): Direction of travel (去程/返程)
- `estimated_time` (str): Human-readable arrival time
- `raw_time_value` (str): Raw time value from API
- `stop_dynamic_id` (str): Dynamic stop identifier

**Example:**
```python
arrival = arrivals[0]
print(f"{arrival.route} - {arrival.estimated_time}")
```

### Python Examples

#### Example 1: Basic Usage

```python
from taipei_bus import TaipeiBusAPI

api = TaipeiBusAPI()
arrivals, last_update = api.get_stop_estimates("捷運公館站")

for arrival in arrivals:
    print(f"{arrival.route}: {arrival.estimated_time}")
```

#### Example 2: Filtering by Route

```python
api = TaipeiBusAPI()
arrivals, _ = api.get_stop_estimates("捷運公館站")

# Filter for specific routes
target_routes = ["0南", "208", "236"]
filtered = [a for a in arrivals if a.route in target_routes]

for arrival in filtered:
    print(f"{arrival.route} → {arrival.estimated_time}")
```

#### Example 3: Custom Stop Mapping

```python
# Use a different mapping file
api = TaipeiBusAPI(stop_mapping_file="custom_stops.json")
arrivals, _ = api.get_stop_estimates("台大")
```

#### Example 4: Error Handling

```python
from taipei_bus import TaipeiBusAPI

api = TaipeiBusAPI()

try:
    arrivals, last_update = api.get_stop_estimates("不存在的站牌")
    
    if not arrivals:
        print("No data available for this stop")
    else:
        for arrival in arrivals:
            print(f"{arrival.route}: {arrival.estimated_time}")
            
except Exception as e:
    print(f"Error fetching data: {e}")
```

#### Example 5: Auto-Refresh Script

```python
import time
from taipei_bus import TaipeiBusAPI

api = TaipeiBusAPI()

while True:
    arrivals, update_time = api.get_stop_estimates("捷運公館站")
    
    print(f"\n{'='*50}")
    print(f"Updated: {update_time}")
    print('='*50)
    
    for arrival in arrivals:
        print(f"{arrival.route:10} | {arrival.estimated_time}")
    
    time.sleep(30)  # Refresh every 30 seconds
```

---

## React Native Version

### React Native Installation

#### Requirements

- React Native 0.60+
- Node.js 14+
- Required packages:

```bash
npm install cheerio
# or
yarn add cheerio
```

#### TypeScript Setup

If not already using TypeScript, add it to your project:

```bash
npm install --save-dev typescript @types/react @types/react-native
```

#### Project Setup

1. Save the `TaipeiBusAPI.ts` file to your project
2. Create or import your `stop_to_slid.json` mapping file
3. Import the JSON in your code or load it dynamically

### React Native Quick Start

```typescript
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';
import stopMapping from './stop_to_slid.json';

// Initialize the API
const api = new TaipeiBusAPI(stopMapping);

// Fetch arrivals
const fetchArrivals = async () => {
  try {
    const { arrivals, lastUpdate } = await api.getStopEstimates('捷運公館站');
    console.log(`Updated: ${lastUpdate}`);
    
    arrivals.forEach(arrival => {
      console.log(`${arrival.route}: ${arrival.estimatedTime}`);
    });
  } catch (error) {
    console.error('Failed to fetch:', error);
  }
};

fetchArrivals();
```

### React Native API Reference

#### Class: `TaipeiBusAPI`

Main client class for interacting with the Taipei Bus API.

##### Constructor

```typescript
constructor(stopMapping: Record<string, string>)
```

**Parameters:**
- `stopMapping`: Object mapping stop names to stop location IDs

**Example:**
```typescript
const stopMapping = {
  "捷運公館站": "12345",
  "師大分部": "67890"
};
const api = new TaipeiBusAPI(stopMapping);
```

##### Static Methods

###### `createWithMapping(mappingPath?: Record<string, string>) -> Promise<TaipeiBusAPI>`

Factory method to create an instance with mapping.

**Parameters:**
- `mappingPath` (optional): Stop mapping object

**Returns:**
- Promise resolving to `TaipeiBusAPI` instance

**Example:**
```typescript
const api = await TaipeiBusAPI.createWithMapping(stopMapping);
```

##### Instance Methods

###### `getStopEstimates(stopName: string) -> Promise<StopEstimatesResponse>`

Get bus arrival estimates for a specific stop.

**Parameters:**
- `stopName`: Name of the bus stop

**Returns:**
- Promise resolving to `StopEstimatesResponse` object

**Example:**
```typescript
const { arrivals, lastUpdate } = await api.getStopEstimates('捷運公館站');
```

#### Interface: `BusArrival`

Represents a single bus arrival estimate.

```typescript
interface BusArrival {
  route: string;              // Bus route name/number
  direction: string;          // Direction of travel
  estimatedTime: string;      // Human-readable arrival time
  rawTimeValue: string;       // Raw time value from API
  stopDynamicId: string;      // Dynamic stop identifier
}
```

#### Interface: `StopEstimatesResponse`

Response from `getStopEstimates()` method.

```typescript
interface StopEstimatesResponse {
  arrivals: BusArrival[];     // Array of bus arrivals
  lastUpdate: string;         // Last update timestamp
}
```

### React Native Examples

#### Example 1: Basic React Component

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';
import stopMapping from './stop_to_slid.json';

export const BusListScreen = () => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const api = new TaipeiBusAPI(stopMapping);

  useEffect(() => {
    loadBusData();
  }, []);

  const loadBusData = async () => {
    try {
      const { arrivals } = await api.getStopEstimates('捷運公館站');
      setArrivals(arrivals);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FlatList
      data={arrivals}
      renderItem={({ item }) => (
        <View>
          <Text>{item.route}</Text>
          <Text>{item.estimatedTime}</Text>
        </View>
      )}
      keyExtractor={(item, index) => `${item.route}-${index}`}
    />
  );
};
```

#### Example 2: With Auto-Refresh

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';
import stopMapping from './stop_to_slid.json';

export const useBusArrivals = (stopName: string, refreshInterval = 30000) => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const apiRef = useRef(new TaipeiBusAPI(stopMapping));

  const fetchData = async () => {
    try {
      const { arrivals, lastUpdate } = await apiRef.current.getStopEstimates(stopName);
      setArrivals(arrivals);
      setLastUpdate(lastUpdate);
    } catch (error) {
      console.error('Error fetching bus data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [stopName, refreshInterval]);

  return { arrivals, lastUpdate, loading, refresh: fetchData };
};

// Usage in component
export const BusScreen = () => {
  const { arrivals, lastUpdate, loading, refresh } = useBusArrivals('捷運公館站');
  
  // Use the data in your UI
};
```

#### Example 3: Multiple Stops

```typescript
import React, { useState, useEffect } from 'react';
import { TaipeiBusAPI } from './TaipeiBusAPI';
import stopMapping from './stop_to_slid.json';

export const MultiStopScreen = () => {
  const [stopsData, setStopsData] = useState({});
  const api = new TaipeiBusAPI(stopMapping);

  const fetchMultipleStops = async (stopNames: string[]) => {
    const results = {};
    
    for (const stopName of stopNames) {
      try {
        const data = await api.getStopEstimates(stopName);
        results[stopName] = data;
      } catch (error) {
        console.error(`Failed to fetch ${stopName}:`, error);
      }
    }
    
    setStopsData(results);
  };

  useEffect(() => {
    fetchMultipleStops(['捷運公館站', '師大分部', '台大']);
  }, []);

  // Render stops data
};
```

#### Example 4: With Pull-to-Refresh

```typescript
import React, { useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';
import stopMapping from './stop_to_slid.json';

export const RefreshableBusList = () => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const api = new TaipeiBusAPI(stopMapping);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { arrivals } = await api.getStopEstimates('捷運公館站');
      setArrivals(arrivals);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      data={arrivals}
      renderItem={({ item }) => (
        <View>
          <Text>{item.route}: {item.estimatedTime}</Text>
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
};
```

#### Example 5: Route Filtering

```typescript
import { TaipeiBusAPI, BusArrival } from './TaipeiBusAPI';

const filterArrivals = (
  arrivals: BusArrival[],
  filters: {
    routes?: string[];
    maxMinutes?: number;
    excludeNotRunning?: boolean;
  }
): BusArrival[] => {
  return arrivals.filter(arrival => {
    // Filter by route
    if (filters.routes && !filters.routes.includes(arrival.route)) {
      return false;
    }
    
    // Filter by time
    if (filters.maxMinutes) {
      const match = arrival.estimatedTime.match(/(\d+)分/);
      if (match && parseInt(match[1]) > filters.maxMinutes) {
        return false;
      }
    }
    
    // Exclude not running buses
    if (filters.excludeNotRunning) {
      const notRunning = ['未發車', '末班已過', '今日未營運'];
      if (notRunning.includes(arrival.estimatedTime)) {
        return false;
      }
    }
    
    return true;
  });
};

// Usage
const { arrivals } = await api.getStopEstimates('捷運公館站');
const filtered = filterArrivals(arrivals, {
  routes: ['0南', '208'],
  maxMinutes: 15,
  excludeNotRunning: true
});
```

---

## Data Structures

### Stop Mapping Format

Both versions require a JSON file mapping stop names to stop location IDs:

```json
{
  "捷運公館站": "1001",
  "師大分部": "1002",
  "台灣大學": "1003"
}
```

### Arrival Time Formats

The `estimatedTime` / `estimated_time` field can contain:

| Value | Meaning |
|-------|---------|
| `進站中` | Bus is arriving at the station |
| `將到站` | Bus will arrive soon (< 3 minutes) |
| `X分` | Bus will arrive in X minutes |
| `未發車` | Bus hasn't departed yet |
| `交管不停` | Not stopping due to traffic control |
| `末班已過` | Last bus has passed |
| `今日未營運` | Not operating today |

---

## Error Handling

### Python

```python
from taipei_bus import TaipeiBusAPI

api = TaipeiBusAPI()

try:
    arrivals, last_update = api.get_stop_estimates("捷運公館站")
except FileNotFoundError as e:
    print(f"Stop mapping file not found: {e}")
except requests.exceptions.RequestException as e:
    print(f"Network error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### React Native

```typescript
import { TaipeiBusAPI } from './TaipeiBusAPI';

const api = new TaipeiBusAPI(stopMapping);

try {
  const { arrivals, lastUpdate } = await api.getStopEstimates('捷運公館站');
  // Handle success
} catch (error) {
  if (error.message.includes('HTTP error')) {
    console.error('Network error:', error);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Status Codes

The API uses the following internal status codes:

| Code | Status | Description |
|------|--------|-------------|
| `0` | 進站中 | Bus is at the station |
| `` | 未發車 | Not yet departed |
| `-1` | 未發車 | Not yet departed |
| `-2` | 交管不停 | Not stopping (traffic control) |
| `-3` | 末班已過 | Last bus has passed |
| `-4` | 今日未營運 | Not operating today |

Positive values represent seconds until arrival:
- `0-179` seconds → "將到站"
- `≥180` seconds → Converted to minutes

---

## Best Practices

### Python

1. **Reuse API Instance**: Create one `TaipeiBusAPI` instance and reuse it
2. **Handle Empty Results**: Always check if `arrivals` list is empty
3. **Rate Limiting**: Don't make requests more frequently than every 15-30 seconds
4. **Error Logging**: Log errors for debugging but handle gracefully

### React Native

1. **Use Refs for API Instance**: Store API instance in `useRef` to avoid recreating
2. **Implement Loading States**: Always show loading indicators
3. **Add Pull-to-Refresh**: Enhance UX with refresh capability
4. **Cache Data**: Consider caching results for offline viewing
5. **Optimize Re-renders**: Use `React.memo` for list items

---

## Troubleshooting

### Common Issues

**Issue**: "Stop mapping file not found"
- **Solution**: Ensure `stop_to_slid.json` is in the correct location

**Issue**: Empty arrivals list
- **Solution**: Verify stop name exists in mapping file and matches exactly

**Issue**: Network timeout
- **Solution**: Check internet connection and API availability

**Issue**: Incorrect time format
- **Solution**: Ensure system has correct timezone settings

---

## Contributing

When extending these libraries:

1. Maintain the same method signatures
2. Add comprehensive error handling
3. Document new methods with docstrings
4. Include unit tests
5. Update this documentation

---

## License

These implementations are provided as-is for interacting with Taipei's public transportation API. Please respect the API's terms of service and rate limits.

---

## Support

For issues or questions:
- Check the troubleshooting section
- Review the examples
- Ensure you're using the latest version
- Verify your stop mapping file is up to date