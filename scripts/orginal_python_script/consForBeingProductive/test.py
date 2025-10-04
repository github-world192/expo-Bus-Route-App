import requests
import html
from bs4 import BeautifulSoup
import json

# REPLACEMENT_CHAR = '\uFFFD'

# with open("busstop.csv", "r", encoding="utf-8") as fr:
#     with open("busstop_clean.csv", "a", encoding="utf-8") as fw:
#         with open("err.txt", 'a', encoding='utf-8') as fa:
#             for line in fr.readlines():
#                 slid = line.split(',')[0]
#                 name = line.split(',')[1]
#                 if REPLACEMENT_CHAR in name:
#                     try:
#                         r = requests.get(f"https://pda5284.gov.taipei/MQS/stoplocation.jsp?slid={slid}")
#                         html_decode = html.unescape(r.text)
#                         soup = BeautifulSoup(html_decode, 'html.parser')
#                         name = soup.find('title').text.split(']')[0].replace('[','')
#                         fw.write(f"{slid},{name}\n")
#                         print(f"change slid: {slid}, original name: {line.split(',')[1]} to {name}")
#                     except:
#                         fa.write(f"{slid}, {name}")
#                 else:
#                     print(f"stay slid: {slid}, name: {name}")
#                     fw.write(f"{slid},{name}")

with open("busstop_clean.csv", 'r', encoding='utf-8') as fr:
    with open("stop_to_slid.json", 'w', encoding="utf-8") as fw:
        data = {}
        for line in fr.readlines():
            slid, name = line.strip().split(',')
            data[name] = slid
        json.dump(data,fw, ensure_ascii=False)
        
# 假設你已經成功讀取 DBF 並轉換成 DataFrame (df)
# 請將這部分替換成你實際的 DataFrame 讀取程式碼
# data = {'ID': [366, 364, 365], 
#         'StationName': ['捷運奇岩站', '捷運石牌站(東', '正常站名']}
# 模擬亂碼 () 被替換字元 (\uFFFD) 取代
# data['StationName'][1] = '729,東吳大學(錢穆�'
# df = pd.DataFrame(data) 

# --- 判斷亂碼的關鍵程式碼 ---

# 1. 定義 Unicode 替換字元 (通常以  顯示)

# 2. 創建一個布林 (Boolean) 欄位來標記包含亂碼的資料行
# str.contains() 函式用來檢查字串中是否包含特定子字串
# print(REPLACEMENT_CHAR in "729,東吳大學(錢穆")
# print("729,東吳大學(錢穆�".astype(str).str.contains(REPLACEMENT_CHAR, na=False))

# # 3. 篩選出所有包含亂碼的資料行
# error_rows = df[df['Has_Encoding_Error']]

# print("--- 原始資料 ---")
# print(df)
# print("\n--- 判斷結果 (包含亂碼的資料行) ---")
# print(error_rows)
# with open("in_page_decoded.html", "r", encoding="utf-8") as fr:
#     soup = BeautifulSoup(fr.read(), 'html.parser')
#     print(soup.find('title').text.split(']')[0].replace('[',''))