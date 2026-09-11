// VetSurgeryTR — Seed de datos realistas para clínica ortopédica veterinaria (Colombia).
// Ejecutar con: bun scripts/seed.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const now = new Date();
const YEAR = now.getFullYear();

// ------------------------------ helpers de fecha -----------------------------

const at = (d: number, h = 9, m = 0): Date => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt;
};
const daysAgo = (d: number, h = 9, m = 0) => at(-d, h, m);
const daysFromNow = (d: number, h = 9, m = 0) => at(d, h, m);
const birth = (years: number, months = 0, day = 10): Date =>
  new Date(now.getFullYear() - years, now.getMonth() - months, day);
const monthsFromNow = (months: number, day = 28): Date =>
  new Date(now.getFullYear(), now.getMonth() + months, day);

async function main() {
  console.log('🧹 Borrando datos existentes…');
  await db.followUp.deleteMany();
  await db.surgeryMaterial.deleteMany();
  await db.inventoryMovement.deleteMany();
  await db.surgery.deleteMany();
  await db.patient.deleteMany();
  await db.owner.deleteMany();
  await db.vet.deleteMany();
  await db.inventoryItem.deleteMany();

  // ================================ VETERINARIOS ==============================
  console.log('👩‍⚕️ Creando veterinarios…');
  const mendoza = await db.vet.create({
    data: {
      fullName: 'Dr. Carlos Mendoza',
      license: 'MV-85432',
      specialty: 'Ortopedia y traumatología',
      phone: '+57 315 765 4321',
      email: 'cmendoza@vetsurgerytr.com.co',
    },
  });
  const restrepo = await db.vet.create({
    data: {
      fullName: 'Dra. Sofía Restrepo',
      license: 'MV-96120',
      specialty: 'Cirugía de tejidos blandos y ortopedia',
      phone: '+57 314 876 5432',
      email: 'srestrepo@vetsurgerytr.com.co',
    },
  });

  // ================================ PROPIETARIOS ==============================
  console.log('👤 Creando propietarios…');
  const ownerDefs = [
    {
      documentType: 'CC',
      documentNumber: '1024587433',
      fullName: 'Juan Carlos Ramírez Salazar',
      phone: '+57 310 456 7890',
      email: 'juan.ramirez@gmail.com',
      address: 'Calle 100 # 15-32, Chapinero',
      city: 'Bogotá D.C.',
      notes: 'Contacto preferido: WhatsApp.',
    },
    {
      documentType: 'CC',
      documentNumber: '52147896',
      fullName: 'María Fernanda Gómez Vélez',
      phone: '+57 312 987 6543',
      email: 'mf.gomez@hotmail.com',
      address: 'Carrera 43A # 10-25, El Poblado',
      city: 'Medellín',
    },
    {
      documentType: 'CC',
      documentNumber: '1147852369',
      fullName: 'Andrés Felipe Torres Quintero',
      phone: '+57 315 234 5678',
      email: 'andres.torres@outlook.com',
      address: 'Avenida 6N # 22-41, Granada',
      city: 'Cali',
    },
    {
      documentType: 'CC',
      documentNumber: '1032654987',
      fullName: 'Luisa Marcela Peña Arenas',
      phone: '+57 320 876 5432',
      address: 'Calle 42 # 29-18, Cabecera',
      city: 'Bucaramanga',
    },
    {
      documentType: 'NIT',
      documentNumber: '900456789-2',
      fullName: 'Fundación Patitas de Amor',
      phone: '+57 601 555 1234',
      email: 'donaciones@patitasdeamor.org',
      address: 'Calle 127 # 20-15, Suba',
      city: 'Bogotá D.C.',
      notes: 'Fundación de rescate canino. Facturación con NIT, canal directo por WhatsApp.',
    },
    {
      documentType: 'CC',
      documentNumber: '79845632',
      fullName: 'Diego Alejandro Herrera Molina',
      phone: '+57 301 345 6789',
      email: 'diego.herrera@gmail.com',
      address: 'Avenida 0 # 12-34, Centro',
      city: 'Cúcuta',
    },
    {
      documentType: 'CC',
      documentNumber: '1085236741',
      fullName: 'Camila Rodríguez Pineda',
      phone: '+57 311 222 3344',
      email: 'camila.rodriguez@gmail.com',
      address: 'Carrera 7 # 63-20, Chapinero Alto',
      city: 'Bogotá D.C.',
    },
    {
      documentType: 'NIT',
      documentNumber: '800123456-7',
      fullName: 'Hacienda El Roble S.A.S.',
      phone: '+57 310 987 1234',
      email: 'gerencia@haciendaelroble.co',
      address: 'Vereda El Roble, Km 12 vía Rionegro',
      city: 'Rionegro, Antioquia',
      notes: 'Establecimiento equino. Paciente Titan (caballo de trabajo).',
    },
  ] as const;
  const owners = [] as { id: string; fullName: string }[];
  for (const o of ownerDefs) {
    const created = await db.owner.create({ data: { ...o } });
    owners.push({ id: created.id, fullName: created.fullName });
  }

  // ================================= PACIENTES ================================
  console.log('🐕 Creando pacientes…');
  const patientDefs = [
    {
      code: `PAC-${YEAR}-0001`,
      ownerId: owners[0].id,
      name: 'Rocky',
      species: 'Canino',
      breed: 'Labrador Retriever',
      sex: 'M',
      birthDate: birth(4, 2),
      weight: 34,
      neutered: true,
      color: 'Dorado',
      notes: 'Ruptura de ligamento cruzado craneal izquierdo confirmada. Muy activo, requiere manejo estricto del reposo.',
    },
    {
      code: `PAC-${YEAR}-0002`,
      ownerId: owners[1].id,
      name: 'Lola',
      species: 'Canino',
      breed: 'French Bulldog',
      sex: 'F',
      birthDate: birth(3),
      weight: 11,
      neutered: true,
      color: 'Blanco con parches',
      notes: 'Luxación de rótula grado II. Propietaria reporta cojera intermitente en miembro posterior.',
    },
    {
      code: `PAC-${YEAR}-0003`,
      ownerId: owners[2].id,
      name: 'Bruno',
      species: 'Canino',
      breed: 'Pastor Alemán',
      sex: 'M',
      birthDate: birth(5, 6),
      weight: 38,
      neutered: false,
      color: 'Negro y fuego',
      microchip: '977000123456789',
      notes: 'Fractura de fémur izquierdo por atropello. ORIF realizada, buena evolución.',
    },
    {
      code: `PAC-${YEAR}-0004`,
      ownerId: owners[3].id,
      name: 'Max',
      species: 'Canino',
      breed: 'Mestizo (Criollo)',
      sex: 'M',
      birthDate: birth(2, 3),
      weight: 18,
      neutered: true,
      color: 'Café con blanco',
      notes: 'Fractura diafisaria de radio y cúbito derecho por atropello. Inmovilizado con férula mientras se programa cirugía.',
    },
    {
      code: `PAC-${YEAR}-0005`,
      ownerId: owners[4].id,
      name: 'Dante',
      species: 'Canino',
      breed: 'Golden Retriever',
      sex: 'M',
      birthDate: birth(6, 1),
      weight: 30,
      neutered: true,
      color: 'Dorado',
      microchip: '977000987654321',
      notes: 'Rescatado por la fundación y adoptado. TPLO derecha realizada hace un mes, en control postoperatorio.',
    },
    {
      code: `PAC-${YEAR}-0006`,
      ownerId: owners[5].id,
      name: 'Pipo',
      species: 'Canino',
      breed: 'Pug',
      sex: 'M',
      birthDate: birth(7),
      weight: 9,
      neutered: true,
      color: 'Arena (fawn)',
      notes: 'Retiro de implantes de radio/ulna realizado. Consolidación ósea completa.',
    },
    {
      code: `PAC-${YEAR}-0007`,
      ownerId: owners[6].id,
      name: 'Selma',
      species: 'Felino',
      breed: 'Mestizo',
      sex: 'F',
      birthDate: birth(4, 2),
      weight: 4.2,
      neutered: true,
      color: 'Gris atigrado',
      notes: 'Luxación tibiotarsiana traumática. Artrodesis de tarso izquierdo en curso.',
    },
    {
      code: `PAC-${YEAR}-0008`,
      ownerId: owners[1].id,
      name: 'Luna',
      species: 'Felino',
      breed: 'Mestizo',
      sex: 'F',
      birthDate: birth(2, 8),
      weight: 5.1,
      neutered: true,
      color: 'Blanco y negro',
      microchip: '977000555111333',
      notes: 'Paciente sana. Consulta por cojera leve en miembro posterior derecho.',
    },
    {
      code: `PAC-${YEAR}-0009`,
      ownerId: owners[7].id,
      name: 'Titan',
      species: 'Equino',
      breed: 'Criollo Colombiano',
      sex: 'M',
      birthDate: birth(8),
      weight: 450,
      neutered: false,
      color: 'Ruano',
      notes: 'Caballo de trabajo. Evaluación por cojera en miembro anterior derecho (sospecha de síndrome navicular).',
    },
  ] as const;
  const patients: Record<string, string> = {};
  for (const p of patientDefs) {
    const created = await db.patient.create({
      data: { ...p, active: true, birthDate: p.birthDate },
    });
    patients[p.name] = created.id;
  }

  // =============================== INVENTARIO =================================
  // entry = cantidad de la ENTRADA inicial (50 días atrás). El stock final se
  // calcula restando los consumos de las cirugías completadas.
  console.log('📦 Creando inventario ortopédico…');
  type ItemDef = {
    code: string;
    name: string;
    category: string;
    subType?: string;
    material?: string;
    size?: string;
    unit: string;
    entry: number;
    minStock: number;
    unitCost?: number;
    supplier?: string;
    lotNumber?: string;
    expiresAt?: Date;
    location?: string;
    notes?: string;
  };

  const itemDefs: ItemDef[] = [
    // ---- PLACAS ----
    { code: 'INV-0001', name: 'Platina LCP 3.5 mm 8 agujeros', category: 'PLACAS', subType: 'LCP (bloqueo)', material: 'Titanio', size: '3.5 mm · 8 agujeros', unit: 'pieza', entry: 2, minStock: 2, unitCost: 850000, supplier: 'Zimmer Veterinary', location: 'Vitrina A-1', notes: 'Sistema de bloqueo — requiere tornillos LCP.' },
    { code: 'INV-0002', name: 'Platina de compresión 2.7 mm 6 agujeros', category: 'PLACAS', subType: 'Compresión (DCP)', material: 'Acero 316L', size: '2.7 mm · 6 agujeros', unit: 'pieza', entry: 4, minStock: 2, unitCost: 620000, supplier: 'Zimmer Veterinary', location: 'Vitrina A-2' },
    { code: 'INV-0003', name: 'Platina T oblicua 3.5 mm reconstrucción', category: 'PLACAS', subType: 'T oblicua (reconstrucción)', material: 'Acero 316L', size: '3.5 mm · 7 agujeros', unit: 'pieza', entry: 3, minStock: 2, unitCost: 740000, supplier: 'Zimmer Veterinary', location: 'Vitrina A-3', notes: 'Ideal para fracturas de radio/ulna y mandíbula.' },
    // ---- TORNILLOS ----
    { code: 'INV-0004', name: 'Tornillo cortical 3.5 mm auto-perforante', category: 'TORNILLOS', subType: 'Cortical auto-perforante', material: 'Acero 316L', size: '3.5 mm', unit: 'pieza', entry: 20, minStock: 10, unitCost: 95000, supplier: 'Zimmer Veterinary', location: 'Vitrina B-1' },
    { code: 'INV-0005', name: 'Tornillo cortical 2.7 mm auto-perforante', category: 'TORNILLOS', subType: 'Cortical auto-perforante', material: 'Acero 316L', size: '2.7 mm', unit: 'pieza', entry: 10, minStock: 5, unitCost: 82000, supplier: 'Zimmer Veterinary', location: 'Vitrina B-1' },
    { code: 'INV-0006', name: 'Tornillo canelado 4.0 mm', category: 'TORNILLOS', subType: 'Canelado (esponjoso)', material: 'Acero 316L', size: '4.0 mm', unit: 'pieza', entry: 10, minStock: 5, unitCost: 105000, supplier: 'Zimmer Veterinary', location: 'Vitrina B-2' },
    { code: 'INV-0007', name: 'Tornillo de bloqueo 3.5 mm cabeza estriada', category: 'TORNILLOS', subType: 'Bloqueo (LCP)', material: 'Titanio', size: '3.5 mm', unit: 'pieza', entry: 15, minStock: 6, unitCost: 105000, supplier: 'Zimmer Veterinary', location: 'Vitrina B-3', notes: 'Exclusivo para platinas LCP.' },
    // ---- PINES ----
    { code: 'INV-0008', name: 'Clavo Kirschner 1.6 mm x 15 cm', category: 'PINES', subType: 'Kirschner', material: 'Acero 316L', size: '1.6 mm x 15 cm', unit: 'pieza', entry: 24, minStock: 12, unitCost: 28000, supplier: 'Kruuse Colombia', location: 'Estante D-1' },
    { code: 'INV-0009', name: 'Clavo Kirschner 2.0 mm x 15 cm', category: 'PINES', subType: 'Kirschner', material: 'Acero 316L', size: '2.0 mm x 15 cm', unit: 'pieza', entry: 12, minStock: 6, unitCost: 32000, supplier: 'Kruuse Colombia', location: 'Estante D-1' },
    { code: 'INV-0010', name: 'Clavo intramedular Steinmann 3.2 mm x 20 cm', category: 'PINES', subType: 'Steinmann', material: 'Acero 316L', size: '3.2 mm x 20 cm', unit: 'pieza', entry: 4, minStock: 2, unitCost: 65000, supplier: 'Kruuse Colombia', location: 'Estante D-2' },
    { code: 'INV-0011', name: 'Clavo intramedular 4.0 mm x 25 cm', category: 'PINES', subType: 'Intramedular', material: 'Acero 316L', size: '4.0 mm x 25 cm', unit: 'pieza', entry: 3, minStock: 2, unitCost: 88000, supplier: 'Kruuse Colombia', location: 'Estante D-2' },
    // ---- ALAMBRES ----
    { code: 'INV-0012', name: 'Alambre de cerclaje 1.0 mm (rollo 25 m)', category: 'ALAMBRES', subType: 'Cerclaje', material: 'Acero 316L', size: '1.0 mm', unit: 'rollo', entry: 6, minStock: 3, unitCost: 45000, supplier: 'Kruuse Colombia', location: 'Estante D-3' },
    { code: 'INV-0013', name: 'Alambre de cerclaje 1.25 mm (rollo 25 m)', category: 'ALAMBRES', subType: 'Cerclaje', material: 'Acero 316L', size: '1.25 mm', unit: 'rollo', entry: 5, minStock: 3, unitCost: 52000, supplier: 'Kruuse Colombia', location: 'Estante D-3' },
    // ---- FIJADORES ----
    { code: 'INV-0014', name: 'Fijador externo tipo II kit completo', category: 'FIJADORES', subType: 'Fijador externo tipo II', material: 'Acero inoxidable', size: 'Clamps 3.5/4.0 mm', unit: 'kit', entry: 2, minStock: 1, unitCost: 2400000, supplier: 'Kruuse Colombia', location: 'Vitrina E-1', notes: 'Incluye barras, clamps y llaves.' },
    { code: 'INV-0015', name: 'Pin transcortical 3.5 mm rosca positiva', category: 'FIJADORES', subType: 'Pin transcortical', material: 'Acero 316L', size: '3.5 mm', unit: 'pieza', entry: 8, minStock: 4, unitCost: 98000, supplier: 'Kruuse Colombia', location: 'Vitrina E-2' },
    // ---- INJERTOS ----
    { code: 'INV-0016', name: 'Aloinjerto óseo cortical liofilizado 5 cc', category: 'INJERTOS', subType: 'Aloinjerto cortical', size: '5 cc', unit: 'frasco', entry: 3, minStock: 2, unitCost: 380000, supplier: 'Banco de Tejidos VetCol', lotNumber: 'BT-2024-118', expiresAt: monthsFromNow(8), location: 'Refrigerado C-2', notes: 'Conservar entre 2-8 °C. No congelar.' },
    { code: 'INV-0017', name: 'Injerto sintético TCP granular 10 cc', category: 'INJERTOS', subType: 'TCP sintético (β-fosfato tricálcico)', size: '10 cc', unit: 'frasco', entry: 4, minStock: 2, unitCost: 290000, supplier: 'Zimmer Veterinary', location: 'Estante C-1' },
    // ---- INSTRUMENTAL ----
    { code: 'INV-0018', name: 'Broca 2.5 mm para ortopedia', category: 'INSTRUMENTAL', subType: 'Broca', material: 'Acero rápido (HSS)', size: '2.5 mm', unit: 'pieza', entry: 5, minStock: 3, unitCost: 165000, supplier: 'Zimmer Veterinary', location: 'Caja de instrumental 1' },
    { code: 'INV-0019', name: 'Broca 2.8 mm para ortopedia', category: 'INSTRUMENTAL', subType: 'Broca', material: 'Acero rápido (HSS)', size: '2.8 mm', unit: 'pieza', entry: 6, minStock: 3, unitCost: 180000, supplier: 'Zimmer Veterinary', location: 'Caja de instrumental 1', notes: 'Para tornillos de bloqueo 3.5 mm (cabeza estriada).' },
    { code: 'INV-0020', name: 'Sierra oscilante hoja 20 mm', category: 'INSTRUMENTAL', subType: 'Hoja de sierra oscilante', material: 'Acero inoxidable', size: '20 mm', unit: 'pieza', entry: 3, minStock: 1, unitCost: 420000, supplier: 'Kruuse Colombia', location: 'Caja de instrumental 2' },
    { code: 'INV-0021', name: 'Guía de brocado 3.5 mm', category: 'INSTRUMENTAL', subType: 'Guía de brocado', material: 'Acero inoxidable', size: '3.5 mm', unit: 'pieza', entry: 4, minStock: 2, unitCost: 210000, supplier: 'Zimmer Veterinary', location: 'Caja de instrumental 1' },
    { code: 'INV-0022', name: 'Pasador de cerclaje', category: 'INSTRUMENTAL', subType: 'Pasador de alambre', material: 'Acero inoxidable', unit: 'pieza', entry: 5, minStock: 2, unitCost: 85000, supplier: 'Kruuse Colombia', location: 'Caja de instrumental 2' },
    // ---- SUTURAS ----
    { code: 'INV-0023', name: 'PDS-II 0 (aguja FS1)', category: 'SUTURAS', subType: 'Monofilamento absorbible', material: 'Polidioxanona', size: '0', unit: 'unidad', entry: 10, minStock: 4, unitCost: 95000, supplier: 'Ethicon Colombia', lotNumber: 'PDS24-118', expiresAt: monthsFromNow(10), location: 'Estante B-1' },
    { code: 'INV-0024', name: 'Monocryl 3-0 (aguja 3/8)', category: 'SUTURAS', subType: 'Monofilamento absorbible', material: 'Polidioxanona (Monocryl)', size: '3-0', unit: 'unidad', entry: 8, minStock: 3, unitCost: 78000, supplier: 'Ethicon Colombia', lotNumber: 'MC24-542', expiresAt: monthsFromNow(9), location: 'Estante B-1' },
    { code: 'INV-0025', name: 'Nylon 4-0 (aguja cutting)', category: 'SUTURAS', subType: 'Monofilamento no absorbible', material: 'Poliamida (Nylon)', size: '4-0', unit: 'unidad', entry: 15, minStock: 5, unitCost: 30000, supplier: 'Ethicon Colombia', lotNumber: 'NY24-231', location: 'Estante B-2' },
    { code: 'INV-0026', name: 'Sutura de acero 5-0 para cerclaje', category: 'SUTURAS', subType: 'Acero quirúrgico', material: 'Acero 316L', size: '5-0', unit: 'unidad', entry: 6, minStock: 3, unitCost: 110000, supplier: 'Kruuse Colombia', location: 'Estante B-2' },
    // ---- MEDICAMENTOS ----
    { code: 'INV-0027', name: 'Cefazolina 1 g inyectable', category: 'MEDICAMENTOS', subType: 'Antibiótico cefalosporina', size: '1 g', unit: 'frasco', entry: 6, minStock: 6, unitCost: 12500, supplier: 'MSD Animal Health', lotNumber: 'CFZ-2409', expiresAt: monthsFromNow(6), location: 'Refrigerado C-1', notes: ' Profilaxis antibiótica preoperatoria (30 min antes de incisión).' },
    { code: 'INV-0028', name: 'Meloxicam 5 mg/mL (frasco 100 mL)', category: 'MEDICAMENTOS', subType: 'AINE (coxib)', size: '5 mg/mL', unit: 'frasco', entry: 5, minStock: 3, unitCost: 42000, supplier: 'MSD Animal Health', lotNumber: 'MLX-2410', expiresAt: monthsFromNow(8), location: 'Refrigerado C-1' },
    { code: 'INV-0029', name: 'Tramadol 50 mg x 20 tabletas', category: 'MEDICAMENTOS', subType: 'Opioide analgésico', size: '50 mg', unit: 'caja', entry: 10, minStock: 4, unitCost: 32000, supplier: 'MSD Animal Health', lotNumber: 'TRM-2411', expiresAt: monthsFromNow(12), location: 'Estante A-2' },
    { code: 'INV-0030', name: 'Propofol 10 mg/mL (frasco 20 mL)', category: 'MEDICAMENTOS', subType: 'Anestésico inyectable', size: '10 mg/mL', unit: 'frasco', entry: 12, minStock: 6, unitCost: 28000, supplier: 'Kruuse Colombia', lotNumber: 'PPF-2408', expiresAt: monthsFromNow(4), location: 'Refrigerado C-2', notes: 'Inducción anestésica. Agitar antes de usar.' },
    { code: 'INV-0031', name: 'Isoflurano 250 mL', category: 'MEDICAMENTOS', subType: 'Anestésico inhalado', size: '250 mL', unit: 'frasco', entry: 3, minStock: 2, unitCost: 310000, supplier: 'Kruuse Colombia', lotNumber: 'ISO-2406', expiresAt: monthsFromNow(14), location: 'Vitrina de anestesia' },
    // ---- INSUMOS ----
    { code: 'INV-0032', name: 'Guantes estériles talla 7.5', category: 'INSUMOS', subType: 'Guante quirúrgico', material: 'Látex', size: '7.5', unit: 'par', entry: 8, minStock: 10, unitCost: 4200, supplier: 'Kruuse Colombia', location: 'Estante E-1', notes: 'CRÍTICO: stock bajo permanente por alto consumo.' },
    { code: 'INV-0033', name: 'Campo quirúrgico impermeable 90x90 cm', category: 'INSUMOS', subType: 'Campo quirúrgico', size: '90x90 cm', unit: 'unidad', entry: 15, minStock: 8, unitCost: 9500, supplier: 'Kruuse Colombia', location: 'Estante E-1' },
    { code: 'INV-0034', name: 'Venda cohesiva 10 cm x 4.5 m', category: 'INSUMOS', subType: 'Venda cohesiva', size: '10 cm', unit: 'rollo', entry: 12, minStock: 6, unitCost: 12500, supplier: 'Kruuse Colombia', location: 'Estante E-2' },
    { code: 'INV-0035', name: 'Gasa estéril 10x10 cm (paquete x5)', category: 'INSUMOS', subType: 'Gasa estéril', size: '10x10 cm', unit: 'paquete', entry: 20, minStock: 8, unitCost: 3500, supplier: 'Kruuse Colombia', location: 'Estante E-2' },
    { code: 'INV-0036', name: 'Apósito de colágeno 10x10 cm', category: 'INSUMOS', subType: 'Apósito de colágeno', size: '10x10 cm', unit: 'unidad', entry: 8, minStock: 4, unitCost: 48000, supplier: 'Kruuse Colombia', lotNumber: 'COL-2417', expiresAt: monthsFromNow(18), location: 'Estante E-3' },
    { code: 'INV-0037', name: 'Vendaje de Robert Jones 15 cm', category: 'INSUMOS', subType: 'Vendaje almohadillado', size: '15 cm', unit: 'unidad', entry: 10, minStock: 5, unitCost: 28000, supplier: 'Kruuse Colombia', location: 'Estante E-3', notes: 'Inmovilización postoperatoria de fracturas femorales.' },
    { code: 'INV-0038', name: 'Collar isabelino mediano', category: 'INSUMOS', subType: 'Collar protector', size: 'Mediano (Ø 25 cm)', unit: 'unidad', entry: 6, minStock: 3, unitCost: 35000, supplier: 'Agencia Vet Colombia', location: 'Estante E-4' },
    { code: 'INV-0039', name: 'Funda postquirúrgica mediana', category: 'INSUMOS', subType: 'Funda protectora', size: 'Mediana', unit: 'unidad', entry: 5, minStock: 2, unitCost: 45000, supplier: 'Agencia Vet Colombia', location: 'Estante E-4' },
  ];

  const items: Record<string, { id: string; unitCost: number | null; stock: number }> = {};
  const t0 = daysAgo(50, 8, 0);
  for (const [i, def] of itemDefs.entries()) {
    const created = await db.inventoryItem.create({
      data: {
        code: def.code,
        name: def.name,
        category: def.category,
        subType: def.subType ?? null,
        material: def.material ?? null,
        size: def.size ?? null,
        unit: def.unit,
        stockQty: def.entry,
        minStock: def.minStock,
        unitCost: def.unitCost ?? null,
        supplier: def.supplier ?? null,
        lotNumber: def.lotNumber ?? null,
        expiresAt: def.expiresAt ?? null,
        location: def.location ?? null,
        notes: def.notes ?? null,
        active: true,
      },
    });
    items[def.code] = { id: created.id, unitCost: def.unitCost ?? null, stock: def.entry };
    // ENTRADA histórica inicial para que existencias y movimientos cuadren.
    await db.inventoryMovement.create({
      data: {
        itemId: created.id,
        type: 'ENTRADA',
        qty: def.entry,
        stockAfter: def.entry,
        unitCost: def.unitCost ?? null,
        reason: 'Compra inicial de inventario (dotación clínica)',
        createdAt: new Date(t0.getTime() + i * 7 * 60 * 1000),
      },
    });
  }

  // ================================= CIRUGÍAS =================================
  console.log('🏥 Creando cirugías…');
  type MaterialDef = { itemCode: string; qtyPlanned: number; qtyUsed?: number; notes?: string };
  type FollowUpDef = { date: Date; type: string; status: string; doneAt?: Date; notes?: string };
  type SurgeryDef = {
    code: string;
    patientName: string;
    vetId: string;
    procedureType: string;
    bodyRegion?: string;
    laterality?: string;
    description?: string;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    status: string;
    durationMin?: number;
    anesthesiaType?: string;
    asaRisk?: number;
    preoperativeNotes?: string;
    postoperativeNotes?: string;
    estimatedCost?: number;
    materials?: MaterialDef[];
    followUps?: FollowUpDef[];
  };

  const surgeryDefs: SurgeryDef[] = [
    // --- CANCELADA hace una semana (creada hace 70 días) ---
    {
      code: `CIR-${YEAR}-0001`,
      patientName: 'Lola',
      vetId: restrepo.id,
      procedureType: 'Reparación de fractura (ORIF)',
      bodyRegion: 'Radio/ulna distal',
      laterality: 'Derecha',
      description:
        'Fractura diafisaria de radio y ulna. Procedimiento cancelado: la propietaria optó por manejo conservador con ferula y control radiográfico semanal.',
      scheduledAt: daysAgo(6, 8, 0),
      createdAt: daysAgo(70, 9, 0),
      status: 'CANCELADA',
      durationMin: 90,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 2,
      preoperativeNotes:
        'Ayuno sólido de 8 h. Radiografías ortostáticas en 2 proyecciones. Perfil preanestésico normal. ASA II (brachycephalic).',
      estimatedCost: 2400000,
    },
    // --- COMPLETADA: TPLO Golden hace 1 mes ---
    {
      code: `CIR-${YEAR}-0002`,
      patientName: 'Dante',
      vetId: mendoza.id,
      procedureType: 'TPLO (Nivelación de la cresta tibial)',
      bodyRegion: 'Tibia proximal',
      laterality: 'Derecha',
      description:
        'Ruptura crónica del ligamento cruzado craneal derecho. TPLO con platina LCP 3.5 mm de 8 agujeros y 7 tornillos de bloqueo.',
      scheduledAt: daysAgo(31, 7, 30),
      startedAt: daysAgo(31, 7, 45),
      completedAt: daysAgo(31, 10, 0),
      createdAt: daysAgo(36, 10, 0),
      status: 'COMPLETADA',
      durationMin: 120,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 2,
      preoperativeNotes:
        'Ayuno sólido 8 h. Radiografías ortostáticas de ambas rodillas para medición de TPA (28°). Hemograma y química sanguínea normales. Premedicación con acepromazina + morfina.',
      postoperativeNotes:
        'Analgesia multimodal: meloxicam 0.2 mg/kg SC + tramadol 4 mg/kg BID x 5 días. Reposo estricto en jaula 30 días. Funda postquirúrgica permanente. Radiografías de control a los 30 y 60 días.',
      estimatedCost: 4800000,
      materials: [
        { itemCode: 'INV-0001', qtyPlanned: 1, qtyUsed: 1, notes: 'Platina LCP 3.5 mm 8 agujeros — medida preoperatoria' },
        { itemCode: 'INV-0007', qtyPlanned: 7, qtyUsed: 7, notes: 'Tornillos corticales + bloqueo proximales y distales' },
        { itemCode: 'INV-0019', qtyPlanned: 1, qtyUsed: 1, notes: 'Broca 2.8 mm para tornillos de bloqueo' },
        { itemCode: 'INV-0023', qtyPlanned: 1, qtyUsed: 1, notes: 'Cierre de fascia y subcutáneo' },
        { itemCode: 'INV-0027', qtyPlanned: 2, qtyUsed: 2, notes: 'Cefazolina 22 mg/kg IV pre y transoperatorio' },
      ],
      followUps: [
        { date: daysAgo(28, 9, 0), type: 'CURACION', status: 'CUMPLIDO', doneAt: daysAgo(28, 9, 30), notes: 'Curación de herida quirúrgica. Buena cicatrización, sin signos de infección.' },
        { date: daysAgo(21, 9, 0), type: 'RETIRO_PUNTOS', status: 'CUMPLIDO', doneAt: daysAgo(21, 9, 20), notes: 'Retiro de puntos de piel. Herida cerrada por primera intención.' },
        { date: daysAgo(1, 9, 0), type: 'CONTROL_RADIOGRAFICO', status: 'PENDIENTE', notes: 'Radiografía de control 30 días post-TPLO. Evaluar consolidación de osteotomía.' },
        { date: daysFromNow(29, 9, 0), type: 'CONTROL_RADIOGRAFICO', status: 'PENDIENTE', notes: 'Radiografía de control 60 días post-TPLO. Evaluar consolidación completa.' },
      ],
    },
    // --- COMPLETADA: reparación de fémur del Pastor Alemán hace 2 semanas ---
    {
      code: `CIR-${YEAR}-0003`,
      patientName: 'Bruno',
      vetId: mendoza.id,
      procedureType: 'Reparación de fractura (ORIF)',
      bodyRegion: 'Fémur (diafisis)',
      laterality: 'Izquierda',
      description:
        'Fractura diafisaria conminuta de fémur izquierdo por atropello. Reducción abierta con platina de compresión 2.7 mm, 4 tornillos corticales y 2 clavos Kirschner intramedulares.',
      scheduledAt: daysAgo(14, 8, 0),
      startedAt: daysAgo(14, 8, 15),
      completedAt: daysAgo(14, 10, 45),
      createdAt: daysAgo(18, 11, 0),
      status: 'COMPLETADA',
      durationMin: 150,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 2,
      preoperativeNotes:
        'Ayuno 8 h. Radiografías ortostáticas de fémur completo. Analgesia preoperatoria con fentanilo. Infusión de fluidos intraoperatoria. ASA II.',
      postoperativeNotes:
        'Analgesia multimodal (meloxicam + tramadol x 7 días). Vendaje de Robert Jones x 5 días. Reposo estricto 45 días. Radiografía de control al mes.',
      estimatedCost: 5200000,
      materials: [
        { itemCode: 'INV-0002', qtyPlanned: 1, qtyUsed: 1, notes: 'Platina de compresión 2.7 mm 6 agujeros' },
        { itemCode: 'INV-0005', qtyPlanned: 4, qtyUsed: 4, notes: 'Tornillos corticales 2.7 mm' },
        { itemCode: 'INV-0009', qtyPlanned: 2, qtyUsed: 2, notes: 'Clavos Kirschner 2.0 mm como clavos intramedulares' },
        { itemCode: 'INV-0024', qtyPlanned: 1, qtyUsed: 1, notes: 'Cierre de planos musculares' },
        { itemCode: 'INV-0028', qtyPlanned: 1, qtyUsed: 1, notes: 'Meloxicam 0.2 mg/kg SC postoperatorio' },
      ],
      followUps: [
        { date: daysAgo(11, 9, 0), type: 'CURACION', status: 'CUMPLIDO', doneAt: daysAgo(11, 9, 30), notes: 'Curación de herida. Vendaje de Robert Jones retirado a los 5 días.' },
        { date: daysAgo(2, 9, 0), type: 'RETIRO_PUNTOS', status: 'PENDIENTE', notes: 'Retiro de puntos de piel pendiente (reprogramado).' },
        { date: daysFromNow(1, 9, 0), type: 'EVALUACION', status: 'PENDIENTE', notes: 'Evaluación clínica de apoyo en miembro y grado de cojera.' },
        { date: daysFromNow(16, 9, 0), type: 'CONTROL_RADIOGRAFICO', status: 'PENDIENTE', notes: 'Radiografía de control 30 días post-ORIF. Evalular callo óseo.' },
      ],
    },
    // --- COMPLETADA: retiro de implantes del Pug hace 10 días ---
    {
      code: `CIR-${YEAR}-0004`,
      patientName: 'Pipo',
      vetId: restrepo.id,
      procedureType: 'Retiro de implantes',
      bodyRegion: 'Radio/ulna',
      laterality: 'Derecha',
      description:
        'Retiro de platina y tornillos de fijación de radio/ulna derecha por consolidación completa (6 meses post-ORIF).',
      scheduledAt: daysAgo(10, 9, 0),
      startedAt: daysAgo(10, 9, 10),
      completedAt: daysAgo(10, 10, 10),
      createdAt: daysAgo(13, 15, 0),
      status: 'COMPLETADA',
      durationMin: 60,
      anesthesiaType: 'Sedación + local',
      asaRisk: 3,
      preoperativeNotes:
        'Ayuno 8 h. Radiografías que confirman consolidación ósea completa. Perfil preanestésico: ASA III (brachycephalic, vigilar vía aérea).',
      postoperativeNotes:
        'Analgesia con meloxicam x 3 días. Curación cada 3 días. Retiro de puntos a los 10-12 días. Collar isabelino hasta cicatrización completa.',
      estimatedCost: 1850000,
      materials: [
        { itemCode: 'INV-0025', qtyPlanned: 1, qtyUsed: 1, notes: 'Cierre de piel con nylon 4-0' },
        { itemCode: 'INV-0035', qtyPlanned: 1, qtyUsed: 1, notes: 'Gasa estéril para apósito' },
        { itemCode: 'INV-0029', qtyPlanned: 1, qtyUsed: 1, notes: 'Tramadol 3 mg/kg BID x 3 días' },
      ],
      followUps: [
        { date: daysAgo(7, 9, 0), type: 'CURACION', status: 'CUMPLIDO', doneAt: daysAgo(7, 9, 30), notes: 'Curación de herida sin complicaciones.' },
        { date: at(0, 9, 0), type: 'EVALUACION', status: 'PENDIENTE', notes: 'Evaluación clínica — apoyo completo en miembro operado.' },
        { date: daysFromNow(20, 9, 0), type: 'CONTROL_RADIOGRAFICO', status: 'PENDIENTE', notes: 'Radiografía de control post-retiro de implantes.' },
      ],
    },
    // --- EN_CURSO hoy: artrodesis felina ---
    {
      code: `CIR-${YEAR}-0005`,
      patientName: 'Selma',
      vetId: mendoza.id,
      procedureType: 'Artrodesis (Fusión articular)',
      bodyRegion: 'Tarso (articulación tibiotarsiana)',
      laterality: 'Izquierda',
      description:
        'Luxación tibiotarsiana traumática con daño cartilaginario severo e inestabilidad crónica. Artrodesis con clavo intramedular Steinmann 3.2 mm, clavos Kirschner y cerclaje.',
      scheduledAt: at(0, now.getHours() - 3, 0),
      startedAt: at(0, now.getHours() - 2, 30),
      createdAt: daysAgo(5, 14, 0),
      status: 'EN_CURSO',
      durationMin: 90,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 2,
      preoperativeNotes:
        'Ayuno 8 h. Radiografías del tarso en 3 proyecciones. Inducción con propofol, mantenimiento con isoflurano. ASA II.',
      estimatedCost: 3200000,
      materials: [
        { itemCode: 'INV-0010', qtyPlanned: 1, notes: 'Clavo intramedular Steinmann 3.2 mm' },
        { itemCode: 'INV-0008', qtyPlanned: 2, notes: 'Clavos Kirschner 1.6 mm' },
        { itemCode: 'INV-0012', qtyPlanned: 1, notes: 'Cerclaje de alambre 1.0 mm' },
        { itemCode: 'INV-0023', qtyPlanned: 1, notes: 'Cierre de planos' },
        { itemCode: 'INV-0030', qtyPlanned: 1, notes: 'Propofol para inducción' },
      ],
      followUps: [
        { date: daysFromNow(4, 9, 0), type: 'CONTROL_RADIOGRAFICO', status: 'PENDIENTE', notes: 'Control radiográfico de artrodesis — evaluar alineación y fijación.' },
      ],
    },
    // --- PROGRAMADA: TPLO del Labrador en 2 días ---
    {
      code: `CIR-${YEAR}-0006`,
      patientName: 'Rocky',
      vetId: mendoza.id,
      procedureType: 'TPLO (Nivelación de la cresta tibial)',
      bodyRegion: 'Tibia proximal',
      laterality: 'Izquierda',
      description:
        'Ruptura completa del ligamento cruzado craneal izquierdo. TPLO con platina LCP 3.5 mm de 8 agujeros y tornillos de bloqueo.',
      scheduledAt: daysFromNow(2, 7, 30),
      createdAt: daysAgo(3, 16, 0),
      status: 'PROGRAMADA',
      durationMin: 120,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 1,
      preoperativeNotes:
        'Ayuno sólido 8 h, agua hasta 2 h antes. Radiografías ortostáticas de ambas rodillas para medición del ángulo TPA (TPA 27°). Laboratorio preanestésico completo. ASA I.',
      postoperativeNotes:
        'Analgesia multimodal x 5 días. Reposo estricto 30 días con correa corta. Radiografías de control 30/60 días. Fisioterapia a partir de la semana 4.',
      estimatedCost: 5600000,
      materials: [
        { itemCode: 'INV-0001', qtyPlanned: 1, notes: 'Platina LCP 3.5 mm 8 agujeros (según TPA)' },
        { itemCode: 'INV-0007', qtyPlanned: 8, notes: 'Tornillos de bloqueo 3.5 mm' },
        { itemCode: 'INV-0019', qtyPlanned: 1, notes: 'Broca 2.8 mm' },
        { itemCode: 'INV-0023', qtyPlanned: 1, notes: 'Cierre de planos' },
        { itemCode: 'INV-0027', qtyPlanned: 2, notes: 'Cefazolina profiláctica' },
        { itemCode: 'INV-0032', qtyPlanned: 2, notes: 'Guantes estériles para cirujano y asistente' },
      ],
    },
    // --- PROGRAMADA: fractura radio/ulna del Mestizo en 5 días ---
    {
      code: `CIR-${YEAR}-0007`,
      patientName: 'Max',
      vetId: restrepo.id,
      procedureType: 'Reparación de fractura (ORIF)',
      bodyRegion: 'Radio/ulna distal',
      laterality: 'Derecha',
      description:
        'Fractura diafisaria transversa de radio y ulna derechas. ORIF con platina de compresión 2.7 mm y clavos Kirschner.',
      scheduledAt: daysFromNow(5, 10, 0),
      createdAt: daysAgo(2, 9, 30),
      status: 'PROGRAMADA',
      durationMin: 90,
      anesthesiaType: 'General inhalatoria',
      asaRisk: 1,
      preoperativeNotes:
        'Ayuno 8 h. Mantener férula de inmovilización hasta el quirófano. Radiografías ortostáticas actualizadas. ASA I.',
      postoperativeNotes:
        'Analgesia multimodal x 5 días. Venda cohesiva x 2 semanas. Reposo 30 días. Radiografía de control al mes.',
      estimatedCost: 2350000,
      materials: [
        { itemCode: 'INV-0002', qtyPlanned: 1, notes: 'Platina de compresión 2.7 mm' },
        { itemCode: 'INV-0005', qtyPlanned: 6, notes: 'Tornillos corticales 2.7 mm' },
        { itemCode: 'INV-0008', qtyPlanned: 2, notes: 'Clavos Kirschner 1.6 mm' },
        { itemCode: 'INV-0024', qtyPlanned: 1, notes: 'Cierre de planos' },
        { itemCode: 'INV-0034', qtyPlanned: 2, notes: 'Venda cohesiva postoperatoria' },
      ],
    },
  ];

  for (const def of surgeryDefs) {
    const surgery = await db.surgery.create({
      data: {
        code: def.code,
        patientId: patients[def.patientName],
        vetId: def.vetId,
        procedureType: def.procedureType,
        bodyRegion: def.bodyRegion ?? null,
        laterality: def.laterality ?? null,
        description: def.description ?? null,
        scheduledAt: def.scheduledAt,
        startedAt: def.startedAt ?? null,
        completedAt: def.completedAt ?? null,
        createdAt: def.createdAt,
        status: def.status,
        durationMin: def.durationMin ?? null,
        anesthesiaType: def.anesthesiaType ?? null,
        asaRisk: def.asaRisk ?? null,
        preoperativeNotes: def.preoperativeNotes ?? null,
        postoperativeNotes: def.postoperativeNotes ?? null,
        estimatedCost: def.estimatedCost ?? null,
      },
    });

    // Materiales de la cirugía
    if (def.materials) {
      for (const m of def.materials) {
        const item = items[m.itemCode];
        await db.surgeryMaterial.create({
          data: {
            surgeryId: surgery.id,
            itemId: item.id,
            qtyPlanned: m.qtyPlanned,
            qtyUsed: m.qtyUsed ?? null,
            unitCost: item.unitCost,
            notes: m.notes ?? null,
          },
        });
      }
    }

    // Movimientos SALIDA por consumo de las cirugías completadas (con stockAfter correcto)
    if (def.status === 'COMPLETADA' && def.materials) {
      for (const m of def.materials) {
        if (m.qtyUsed == null) continue;
        const item = items[m.itemCode];
        item.stock -= m.qtyUsed;
        await db.inventoryMovement.create({
          data: {
            itemId: item.id,
            type: 'SALIDA',
            qty: m.qtyUsed,
            stockAfter: item.stock,
            surgeryId: surgery.id,
            reason: `Consumo cirugía ${def.code}`,
            createdAt: new Date(def.completedAt!.getTime() + 15 * 60 * 1000),
          },
        });
      }
    }

    // Controles postoperatorios
    if (def.followUps) {
      for (const f of def.followUps) {
        await db.followUp.create({
          data: {
            surgeryId: surgery.id,
            scheduledDate: f.date,
            type: f.type,
            notes: f.notes ?? null,
            status: f.status,
            doneAt: f.doneAt ?? null,
            createdAt: def.createdAt,
          },
        });
      }
    }
  }

  // Ajustar el stock final de cada item para que cuadre con los movimientos.
  for (const def of itemDefs) {
    const item = items[def.code];
    await db.inventoryItem.update({
      where: { id: item.id },
      data: { stockQty: item.stock },
    });
  }

  // ================================ RESUMEN ===================================
  const [ownerCount, patientCount, vetCount, itemCount, surgeryCount, materialCount, movementCount, followUpCount] =
    await Promise.all([
      db.owner.count(),
      db.patient.count(),
      db.vet.count(),
      db.inventoryItem.count(),
      db.surgery.count(),
      db.surgeryMaterial.count(),
      db.inventoryMovement.count(),
      db.followUp.count(),
    ]);

  const lowStock = await db.inventoryItem.findMany({ where: { active: true } });
  const lowStockList = lowStock.filter((i) => i.stockQty <= i.minStock);

  console.log('\n✅ Seed completado — VetSurgeryTR (clínica de cirugía ortopédica)\n');
  console.log(`   Veterinarios:        ${vetCount} (Dr. Mendoza, Dra. Restrepo)`);
  console.log(`   Propietarios:        ${ownerCount}`);
  console.log(`   Pacientes:           ${patientCount} (codes PAC-${YEAR}-0001 … PAC-${YEAR}-0009)`);
  console.log(`   Items inventario:    ${itemCount} (codes INV-0001 … INV-0039)`);
  console.log(`   Cirugías:            ${surgeryCount} (codes CIR-${YEAR}-0001 … CIR-${YEAR}-0007)`);
  console.log(`   Materiales:          ${materialCount} (${surgeryDefs.filter((s) => s.materials && s.status !== 'COMPLETADA').length} cirugías con planificación)`);
  console.log(`   Movimientos:         ${movementCount} (entradas iniciales + salidas por consumo)`);
  console.log(`   Controles postop:    ${followUpCount}`);
  console.log(`   Alertas stock bajo:  ${lowStockList.length} — ${lowStockList.map((i) => `${i.code} (${i.stockQty}/${i.minStock})`).join(', ')}`);
  console.log('\nEstados de cirugía: 2 PROGRAMADAS (+2 y +5 días) · 1 EN_CURSO (hoy) · 3 COMPLETADAS · 1 CANCELADA');
  console.log('Stock final consistente con los movimientos (stockAfter encadenados). 🎉\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
