// src/types/index.ts

/**  
 * Enum status APAR  
 */
export type APARStatus = 'Sehat' | 'Maintenance' | 'Expired';

/**  
 * Data mentah dari API  
 */
export interface AparRaw {
  id_apar: string;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  keperluan_check: string;           // JSON string
  qr_code_apar: string | null;
  status_apar: APARStatus;
  tgl_exp: string;
  tgl_terakhir_maintenance: string;
  interval_maintenance: number;
  keterangan: string;
}

/**  
 * Bentuk data yang kita gunakan di UI  
 */
export interface APAR {
  id: string;               // dari id_apar
  type: string;             // dari jenis_apar
  location: string;         // dari lokasi_apar
  petugas: string;          // dari keterangan (atau 'N/A')
  daysRemaining: number;    // hari tersisa
  nextCheckDate: string;    // 'YYYY-MM-DD'
  status: APARStatus;       // sama dengan status_apar
  interval: number;         // dari interval_maintenance
  weight?: string;          // parsed dari keperluan_check JSON, kalau ada
}
