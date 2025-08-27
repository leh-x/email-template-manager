use std::fs;
use std::env;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Local};
use serde_json::Value;

#[derive(serde::Serialize)]
pub struct TemplateFile 
{
    name: String,
    content: String,
    last_modified: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct Signature {
    signature_name: String,
    name: String,
    position: String,
    department: String,
    company: String,
    location: HashMap<String, String>, // { name: ..., address: ... }
    image_filename: String,
}


#[derive(serde::Serialize, serde::Deserialize)]
pub struct Cache {
    signature_view_last_selected_signature: Option<String>,
    email_view_last_selected_signature: Option<String>,
    email_view_last_selected_salutation: Option<String>,
    email_view_last_selected_valediction: Option<String>,
}


fn exe_dir() -> Result<PathBuf, String> 
{
  let exe_path = env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe_path.parent().ok_or("Failed to get executable directory")?;
  
  Ok(dir.to_path_buf())
}

fn data_dir() -> Result<PathBuf, String> {
  Ok(exe_dir()?.join("data"))
}

fn templates_dir() -> Result<PathBuf, String> {
  Ok(exe_dir()?.join("Templates"))
}

fn signatures_dir() -> Result<PathBuf, String> {
  Ok(exe_dir()?.join("Signatures"))
}

fn images_dir() -> Result<PathBuf, String> {
  Ok(signatures_dir()?.join("images"))
}

fn ensure_dir(p: &Path) -> Result<(), String> {
  fs::create_dir_all(p).map_err(|e| e.to_string())
}

/// Create the baseline folder tree. Safe to call multiple times.
pub fn ensure_base_dirs() -> Result<(), String> 
{
  ensure_dir(&templates_dir()?)?;
  ensure_dir(&data_dir()?)?;
  ensure_dir(&signatures_dir()?)?;
  ensure_dir(&images_dir()?)?;
  Ok(())
}

/// Light filename hygiene to avoid path traversal / illegal chars.
fn sanitize_filename(input: &str) -> String 
{
  let mut s = input.trim().to_string();
  if s.is_empty() {
    s = "Untitled".into();
  }
  s.chars()
    .map(|c| match c {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
      _ => c,
    })
    .collect()
}


#[tauri::command]
pub fn clear_cache(file_name: String) -> Result<(), String> 
{
  ensure_base_dirs()?; // ensure data dir exists
  let file_path = data_dir()?.join(file_name);
  
  if file_path.exists() {
    fs::remove_file(&file_path).map_err(|e| e.to_string())?;
  }

  Ok(())
}

// commands.rs

#[tauri::command]
pub fn load_cache() -> Result<Cache, String> {
    ensure_base_dirs()?;
    let cache_path = data_dir()?.join("cache.json");

    if !cache_path.exists() {
        return Ok(Cache {
            signature_view_last_selected_signature: None,
            email_view_last_selected_signature: None,
            email_view_last_selected_salutation: None,
            email_view_last_selected_valediction: None,
        });
    }

    let content = fs::read_to_string(&cache_path).map_err(|e| e.to_string())?;
    let cache: Cache = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(cache)
}


#[tauri::command]
pub fn save_cache(cache: Cache) -> Result<(), String> 
{
  ensure_base_dirs()?;

  let cache_path = data_dir()?.join("cache.json");
  let content = serde_json::to_string_pretty(&cache).map_err(|e| e.to_string())?;
  
  fs::write(&cache_path, content).map_err(|e| e.to_string())?;
  
  Ok(())
}

// commands.rs
use std::time::Duration;
use std::thread;

// ...existing structs...

#[tauri::command]
pub fn update_cache(patch: serde_json::Value) -> Result<(), String> {
    ensure_base_dirs()?;
    let cache_path = data_dir()?.join("cache.json");
    let lock_path  = data_dir()?.join("cache.json.lock");

    // --- naive cross-platform lock file ---
    let mut attempts = 0u32;
    while fs::OpenOptions::new().write(true).create_new(true).open(&lock_path).is_err() {
        attempts += 1;
        if attempts > 100 { // ~2s max
            return Err("Timed out waiting for cache lock".into());
        }
        thread::sleep(Duration::from_millis(20));
    }

    // Always release lock at the end
    let result = (|| {
        // Load current cache
        let current = if cache_path.exists() {
            let s = fs::read_to_string(&cache_path).map_err(|e| e.to_string())?;
            serde_json::from_str::<Cache>(&s).unwrap_or(Cache {
                signature_view_last_selected_signature: None,
                email_view_last_selected_signature: None,
                email_view_last_selected_salutation: None,
                email_view_last_selected_valediction: None,
            })
        } else {
            Cache {
                signature_view_last_selected_signature: None,
                email_view_last_selected_signature: None,
                email_view_last_selected_salutation: None,
                email_view_last_selected_valediction: None,
            }
        };

        // Apply patch to known keys
        let mut next = current;
        if let Some(obj) = patch.as_object() {
            if obj.contains_key("signature_view_last_selected_signature") {
                next.signature_view_last_selected_signature =
                    obj.get("signature_view_last_selected_signature")
                       .and_then(|v| v.as_str().map(|s| s.to_string()));
            }
            if obj.contains_key("email_view_last_selected_signature") {
                next.email_view_last_selected_signature =
                    obj.get("email_view_last_selected_signature")
                       .and_then(|v| v.as_str().map(|s| s.to_string()));
            }
            if obj.contains_key("email_view_last_selected_salutation") {
                next.email_view_last_selected_salutation =
                    obj.get("email_view_last_selected_salutation")
                       .and_then(|v| v.as_str().map(|s| s.to_string()));
            }
            if obj.contains_key("email_view_last_selected_valediction") {
                next.email_view_last_selected_valediction =
                    obj.get("email_view_last_selected_valediction")
                       .and_then(|v| v.as_str().map(|s| s.to_string()));
            }
        }

        // Atomic write: write to .tmp then rename
        let tmp = cache_path.with_extension("json.tmp");
        let content = serde_json::to_string_pretty(&next).map_err(|e| e.to_string())?;
        {
            use std::io::Write;
            let mut f = fs::OpenOptions::new()
                .create(true).write(true).truncate(true)
                .open(&tmp).map_err(|e| e.to_string())?;
            f.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
            f.sync_all().ok(); // best-effort
        }

        // Replace original
        if cache_path.exists() {
            fs::remove_file(&cache_path).ok();
        }
        fs::rename(&tmp, &cache_path).map_err(|e| e.to_string())?;
        Ok(())
    })();

    // release lock
    fs::remove_file(&lock_path).ok();
    result
}


#[tauri::command]
pub fn get_signature_image_base64(filename: String) -> Result<String, String> 
{
  ensure_base_dirs()?;                  // ensure images dir exists
  let image_path: PathBuf = images_dir()?.join(&filename);
  
  if !image_path.exists() {
    return Err(format!("Image file '{}' not found", filename));
  }

  let image_bytes = fs::read(&image_path).map_err(|e| e.to_string())?;
  let base64_string = general_purpose::STANDARD.encode(image_bytes);
  
  Ok(base64_string)
}


#[tauri::command]
pub fn delete_signature_file(name: String) -> Result<(), String> 
{
  ensure_base_dirs()?;
  let sig_path = signatures_dir()?.join(format!("{}.json", name));
  
  if sig_path.exists() {
    fs::remove_file(sig_path).map_err(|e| e.to_string())?;
  }

  Ok(())
}


#[tauri::command]
pub fn load_signature_file(name: String) -> Result<Signature, String> 
{
  ensure_base_dirs()?;
  let sig_path = signatures_dir()?.join(format!("{}.json", name));
  
  if !sig_path.exists() {
    return Err(format!("Signature '{}' not found", name));
  }

  let content = fs::read_to_string(&sig_path).map_err(|e| e.to_string())?;
  let signature: Signature = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  
  Ok(signature)
}


#[tauri::command]
pub fn load_signatures() -> Result<Vec<String>, String> 
{
  ensure_base_dirs()?;

  let sig_dir = signatures_dir()?;
  let mut names = Vec::new();

  for entry in fs::read_dir(sig_dir).map_err(|e| e.to_string())? 
  {
    let entry = entry.map_err(|e| e.to_string())?;
    let path: PathBuf = entry.path();
    
    if path.extension().map_or(false, |ext| ext == "json") {
      if let Some(name) = path.file_stem().map(|s| s.to_string_lossy().to_string()) {
        names.push(name);
      }
    }
  }
  Ok(names)
}


#[tauri::command]
pub fn save_signature_to_file(signature: Signature) -> Result<(), String> 
{
  ensure_base_dirs()?;

  let sig_dir = signatures_dir()?;

  ensure_dir(&sig_dir)?;

  let filename = format!("{}.json", signature.signature_name);
  let file_path = sig_dir.join(filename);
  let content = serde_json::to_string_pretty(&signature).map_err(|e| e.to_string())?;
  
  fs::write(&file_path, content).map_err(|e| e.to_string())?;
  
  Ok(())
}


#[tauri::command]
pub fn load_locations() -> Result<HashMap<String, String>, String> 
{
  ensure_base_dirs()?;

  let loc_path = data_dir()?.join("locations.json");

  if !loc_path.exists() {
    return Ok(HashMap::new());
  }

  let content = fs::read_to_string(&loc_path).map_err(|e| e.to_string())?;
  let locations: HashMap<String, String> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  
  Ok(locations)
}


#[tauri::command]
pub fn load_favourites() -> Result<Vec<String>, String> 
{
  ensure_base_dirs()?;
  let fav_path = data_dir()?.join("favourites.json");
  
  if !fav_path.exists() {
    return Ok(vec![]);
  }

  let content = fs::read_to_string(&fav_path).map_err(|e| e.to_string())?;
  let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  let mut out: Vec<String> = Vec::new();

  match json {
    Value::Array(arr) => {
      for v in arr {
        if let Some(s) = v.as_str() {
          out.push(s.to_string());
        }
      }
    }

    Value::Object(map) => {
      // Legacy format: { "file.txt": true/false }
      for (k, v) in map {
        if v.as_bool().unwrap_or(false) {
          out.push(k);
        }
      }
    }
    _ => {}
  }

  Ok(out)
}


#[tauri::command]
pub fn save_favourites(favourites: Vec<String>) -> Result<(), String> 
{
  ensure_base_dirs()?;

  let fav_path = data_dir()?.join("favourites.json");
  let content = serde_json::to_string_pretty(&favourites).map_err(|e| e.to_string())?;
  
  fs::write(&fav_path, content).map_err(|e| e.to_string())?;
  
  Ok(())
}


#[tauri::command]
pub fn load_templates() -> Result<Vec<TemplateFile>, String> 
{
  let templates_dir = templates_dir()?;
  ensure_dir(&templates_dir)?;            // create if missing

  let mut templates = Vec::new();
  
  for entry in fs::read_dir(templates_dir).map_err(|e| e.to_string())? 
  {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    
    // Only process .txt files
    if path.extension().map_or(false, |ext| ext == "txt") {
      let name = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

      let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
      let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
      let modified = metadata.modified().map_err(|e| e.to_string())?;
      let datetime: DateTime<Local> = modified.into();
      let last_modified = datetime.format("%Y-%m-%d %H:%M:%S").to_string();

      templates.push(TemplateFile {
        name,
        content,
        last_modified,
      });
    }
  }
  
  Ok(templates)
}


#[tauri::command]
pub fn save_template(name: String, content: String) -> Result<(), String> 
{
  let dir = templates_dir()?;

  ensure_dir(&dir)?;                       // create if missing

  let filename = format!("{}.txt", sanitize_filename(&name));
  let p = dir.join(filename);

  fs::write(&p, content).map_err(|e| e.to_string())?;

  Ok(())
}


fn load_string_list(file: &str) -> Result<Vec<String>, String> 
{
  let p = data_dir()?.join(file);

  if !p.exists() {
    return Ok(vec![]);
  }

  let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
  let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  
  match json {
    Value::Array(arr) => Ok(
      arr.into_iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect(),
    ),
    _ => Ok(vec![]),
  }
}


#[tauri::command]
pub fn load_salutations() -> Result<Vec<String>, String> {
  ensure_base_dirs()?;
  load_string_list("salutations.json")
}


#[tauri::command]
pub fn load_valedictions() -> Result<Vec<String>, String> {
  ensure_base_dirs()?;
  load_string_list("valedictions.json")
}