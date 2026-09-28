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

use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct AppPaths {
    pub app_dir: String,
    pub db_path: String,
    pub backup_dir: String,
}

fn resolve_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let p_str = parent.to_string_lossy();
            if p_str.ends_with("target\\debug") || p_str.ends_with("target/debug") || p_str.ends_with("target\\release") || p_str.ends_with("target/release") {
                if let Ok(curr) = std::env::current_dir() {
                    return curr;
                }
            }
            return parent.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
fn get_app_paths() -> Result<AppPaths, String> {
    let base_dir = resolve_base_dir();
    let db_path = base_dir.join("arena.db");
    let backup_dir = base_dir.join("ArenaBackup");

    if !backup_dir.exists() {
        let _ = std::fs::create_dir_all(&backup_dir);
    }

    Ok(AppPaths {
        app_dir: base_dir.to_string_lossy().to_string(),
        db_path: db_path.to_string_lossy().to_string().replace('\\', "/"),
        backup_dir: backup_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn save_local_backup(filename: String, data: Vec<u8>) -> Result<String, String> {
    let base_dir = resolve_base_dir();
    let backup_dir = base_dir.join("ArenaBackup");
    if !backup_dir.exists() {
        std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    }
    let target = backup_dir.join(&filename);
    std::fs::write(&target, data).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn open_backup_folder() -> Result<(), String> {
    let base_dir = resolve_base_dir();
    let backup_dir = base_dir.join("ArenaBackup");
    if !backup_dir.exists() {
        let _ = std::fs::create_dir_all(&backup_dir);
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(&backup_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            sync_wallet_online,
            get_app_paths,
            save_local_backup,
            open_backup_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

