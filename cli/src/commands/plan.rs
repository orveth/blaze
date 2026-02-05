//! `blaze plan` - Plan management commands.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_json;
use crate::types::{PlanCreate, PlanFileCreate, PlanFileUpdate, PlanStatus, PlanUpdate};

/// List plans with optional status filter
pub async fn list(client: &Client, status: Option<PlanStatus>) -> Result<()> {
    let plans = client.list_plans(status).await?;
    print_json(&plans);
    Ok(())
}

/// Show a single plan
pub async fn show(client: &Client, plan_id: &str) -> Result<()> {
    let plan = client.get_plan(plan_id).await?;
    print_json(&plan);
    Ok(())
}

/// Create a new plan
pub async fn add(client: &Client, title: String, file: Option<String>) -> Result<()> {
    let files = if let Some(filename) = file {
        vec![PlanFileCreate {
            name: filename,
            content: String::new(),
        }]
    } else {
        Vec::new()
    };

    let plan = client
        .create_plan(&PlanCreate { title, files })
        .await?;
    print_json(&plan);
    Ok(())
}

/// Update a plan
pub async fn edit(
    client: &Client,
    plan_id: &str,
    title: Option<String>,
    status: Option<PlanStatus>,
) -> Result<()> {
    let update = PlanUpdate { title, status };
    let plan = client.update_plan(plan_id, &update).await?;
    print_json(&plan);
    Ok(())
}

/// Delete a plan
pub async fn rm(client: &Client, plan_id: &str, force: bool) -> Result<()> {
    if !force {
        eprintln!("Delete plan {}? [y/N] ", plan_id);
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        if !input.trim().eq_ignore_ascii_case("y") {
            eprintln!("Aborted.");
            return Ok(());
        }
    }

    client.delete_plan(plan_id).await?;
    eprintln!("Deleted plan {}", plan_id);
    Ok(())
}

/// Add a file to a plan
pub async fn file_add(client: &Client, plan_id: &str, filename: &str) -> Result<()> {
    let file = PlanFileCreate {
        name: filename.to_string(),
        content: String::new(),
    };
    let plan = client.add_plan_file(plan_id, &file).await?;
    print_json(&plan);
    Ok(())
}

/// Show a file from a plan
pub async fn file_show(client: &Client, plan_id: &str, filename: &str) -> Result<()> {
    let file = client.get_plan_file(plan_id, filename).await?;
    print_json(&file);
    Ok(())
}

/// Update a file in a plan (content from stdin or argument)
pub async fn file_edit(
    client: &Client,
    plan_id: &str,
    filename: &str,
    new_name: Option<String>,
    content: Option<String>,
) -> Result<()> {
    let update = PlanFileUpdate {
        name: new_name,
        content,
    };
    let plan = client.update_plan_file(plan_id, filename, &update).await?;
    print_json(&plan);
    Ok(())
}

/// Delete a file from a plan
pub async fn file_rm(client: &Client, plan_id: &str, filename: &str) -> Result<()> {
    let plan = client.delete_plan_file(plan_id, filename).await?;
    print_json(&plan);
    Ok(())
}
