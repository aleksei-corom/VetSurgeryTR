use serde::{Deserialize, Serialize};

/// Ítem del inventario ortopédico (platina, tornillo, sutura...).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub id: i32,
    /// INV-NNNN
    pub code: String,
    pub name: String,
    /// PLACAS | TORNILLOS | PINES | ALAMBRES | FIJADORES | INJERTOS |
    /// INSTRUMENTAL | SUTURAS | MEDICAMENTOS | INSUMOS
    pub category: String,
    /// LCP, cortical, Kirschner...
    pub sub_type: Option<String>,
    /// Acero 316L, Titanio, PDS...
    pub material: Option<String>,
    /// 2.7 mm, 1.6 mm x 15 cm...
    pub size: Option<String>,
    /// pieza | caja | rollo | frasco...
    pub unit: String,
    pub stock_qty: f64,
    pub min_stock: f64,
    /// COP
    pub unit_cost: Option<f64>,
    pub supplier: Option<String>,
    pub lot_number: Option<String>,
    /// YYYY-MM-DD
    pub expires_at: Option<String>,
    pub location: Option<String>,
    pub active: bool,
    pub notes: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
    /// YYYY-MM-DD HH:MM:SS
    pub updated_at: String,
}

/// Datos para crear un ítem. Si stockQty > 0 se registra la ENTRADA inicial
/// para que existencias y movimientos cuadren (misma regla que la web).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInventoryItemInput {
    pub name: String,
    pub category: String,
    pub sub_type: Option<String>,
    pub material: Option<String>,
    pub size: Option<String>,
    pub unit: String,
    pub stock_qty: Option<f64>,
    pub min_stock: Option<f64>,
    pub unit_cost: Option<f64>,
    pub supplier: Option<String>,
    pub lot_number: Option<String>,
    /// YYYY-MM-DD
    pub expires_at: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
}

/// Actualización parcial de ítem (None = dejar sin cambio). El stock NUNCA se
/// edita directo: siempre a través de movimientos ENTRADA/SALIDA/AJUSTE.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInventoryItemInput {
    pub name: Option<String>,
    pub category: Option<String>,
    pub sub_type: Option<String>,
    pub material: Option<String>,
    pub size: Option<String>,
    pub unit: Option<String>,
    pub min_stock: Option<f64>,
    pub unit_cost: Option<f64>,
    pub supplier: Option<String>,
    pub lot_number: Option<String>,
    pub expires_at: Option<String>,
    pub location: Option<String>,
    pub active: Option<bool>,
    pub notes: Option<String>,
}

/// Ítem resumido dentro de un movimiento.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementItemRef {
    pub id: i32,
    pub code: String,
    pub name: String,
    pub unit: String,
}

/// Movimiento de inventario con snapshot del stock resultante.
/// ENTRADA suma stock · SALIDA resta (valida stock) · AJUSTE fija el absoluto.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryMovement {
    pub id: i32,
    pub item_id: i32,
    /// ENTRADA | SALIDA | AJUSTE
    #[serde(rename = "type")]
    pub movement_type: String,
    /// ENTRADA/SALIDA: delta · AJUSTE: valor final contado
    pub qty: f64,
    /// snapshot del stock resultante
    pub stock_after: f64,
    pub unit_cost: Option<f64>,
    pub reason: Option<String>,
    /// Origen cuando la salida es consumo quirúrgico.
    pub surgery_id: Option<i32>,
    pub surgery_code: Option<String>,
    pub patient_name: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
    pub item: Option<MovementItemRef>,
}

/// Datos para registrar un movimiento.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMovementInput {
    /// ENTRADA | SALIDA | AJUSTE
    #[serde(rename = "type")]
    pub movement_type: String,
    pub qty: f64,
    pub unit_cost: Option<f64>,
    pub reason: Option<String>,
    pub surgery_id: Option<i32>,
}

/// Resultado de registrar un movimiento: el movimiento y el ítem actualizado.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementResult {
    pub movement: InventoryMovement,
    pub item: InventoryItem,
}

/// Detalle de un ítem con su historial de movimientos (máx. 50, igual que web).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItemDetail {
    pub item: InventoryItem,
    pub movements: Vec<InventoryMovement>,
}
