use std::process::Command;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn sync_wallet_online(
    url: String,
    username: Option<String>,
    password: Option<String>,
    endpoint: Option<String>,
) -> Result<String, String> {
    let clean_url = url.trim_end_matches('/');
    
    // مسیر موقت ذخیره کوکی سشن
    let mut temp_cookie = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    temp_cookie.push(format!("arena_sync_cookie_{}_{}.txt", std::process::id(), timestamp));
    let cookie_path = temp_cookie.to_string_lossy().to_string();

    // ۱. در صورت وجود مشخصات ورود، ابتدا لاگین می‌کنیم تا کوکی سشن ایجاد شود
    if let (Some(u), Some(p)) = (username.as_ref(), password.as_ref()) {
        if !u.trim().is_empty() && !p.is_empty() {
            let body = serde_json::json!({
                "action": "login",
                "username": u.trim(),
                "password": p
            }).to_string();

            let auth_url = format!("{}/api/auth", clean_url);
            let output = Command::new("curl.exe")
                .args([
                    "-s",
                    "-c", &cookie_path,
                    "-X", "POST",
                    &auth_url,
                    "-H", "Content-Type: application/json",
                    "--data-raw", &body
                ])
                .output()
                .map_err(|e| format!("خطا در اجرای ارتباط مستقیم (curl): {}", e))?;

            let res_str = String::from_utf8_lossy(&output.stdout).to_string();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&res_str) {
                if let Some(err) = val.get("error").and_then(|v| v.as_str()) {
                    let _ = std::fs::remove_file(&cookie_path);
                    return Err(err.to_string());
                }
            }
        }
    }

    // ۲. دریافت اطلاعات از اندپوینت درخواستی با کوکی احراز هویت
    let path = endpoint.unwrap_or_else(|| "/api/transactions?limit=250".to_string());
    let target_url = format!("{}{}", clean_url, path);
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "-b", &cookie_path,
        "-X", "GET",
        &target_url,
        "-H", "Accept: application/json"
    ]);

    let output = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&cookie_path);
        format!("خطا در دریافت اطلاعات از سرور: {}", e)
    })?;

    // پاکسازی فایل کوکی موقت
    let _ = std::fs::remove_file(&cookie_path);

    let res_str = String::from_utf8_lossy(&output.stdout).to_string();
    if res_str.trim().is_empty() {
        return Err("پاسخی از سرور دریافت نشد. لطفاً از اتصال اینترنت و صحت آدرس سرور اطمینان حاصل فرمایید.".to_string());
    }

    // بررسی خطای بازگشتی از API سرور
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&res_str) {
        if let Some(err) = val.get("error").and_then(|v| v.as_str()) {
            return Err(err.to_string());
        }
    }

    Ok(res_str)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![greet, sync_wallet_online])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
