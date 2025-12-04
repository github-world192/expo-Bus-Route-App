import html

def decode_html_entities_in_file(input_filename="in_page.html", output_filename="in_page_decoded.html", encoding="utf-8"):
    """
    讀取包含 HTML 實體的檔案，將實體解碼為其對應的字元，
    並將結果寫入新檔案。
    
    例如：&#x516c; 會被轉換成「公」
    
    :param input_filename: 輸入 HTML 檔案的路徑
    :param output_filename: 輸出解碼後內容的檔案路徑
    :param encoding: 檔案編碼，通常是 'utf-8'
    """
    try:
        # 1. 讀取檔案內容
        with open(input_filename, 'r', encoding=encoding) as f:
            html_content = f.read()
            print(f"成功讀取檔案: {input_filename}")

        # 2. 使用 html.unescape() 進行解碼
        # 它會處理所有類型的 HTML 實體，包括 &#x...; (十六進位) 和 &...; (命名實體)
        decoded_content = html.unescape(html_content)
        
        # 3. 將解碼後的內容寫入新檔案
        with open(output_filename, 'w', encoding=encoding) as f:
            f.write(decoded_content)
            print(f"解碼後的內容已成功寫入: {output_filename}")
            
    except FileNotFoundError:
        print(f"錯誤：找不到檔案 {input_filename}。請確認檔案是否存在。")
    except Exception as e:
        print(f"處理檔案時發生錯誤: {e}")

# 執行函式
# 假設你的 HTML 檔案名為 page.html
decode_html_entities_in_file()

# 你也可以測試一個包含 &#x516c; 的字串：
test_string = "這是一個測試字串，包含 &#x516c; 和 &#x570b; 字。"
decoded_test = html.unescape(test_string)
print("\n--- 測試字串解碼 ---")
print(f"原始字串: {test_string}")
print(f"解碼結果: {decoded_test}")
# 解碼結果應該是：「這是一個測試字串，包含 公 和 國 字。」