// src/types/petugas.ts
export interface PetugasInfo {
  badge: string;
  role?: string | null;
  lokasiId?: number | null;
  lokasiNama?: string | null;
  intervalId?: number | null;
  intervalNama?: string | null;
  intervalBulan?: number | null;
}

export interface EmployeeInfo {
  badge: string;
  nama?: string | null;
  divisi?: string | null;
  departemen?: string | null;
  status?: string | null;
}

export function isRescue(role?: string | null) {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'rescue' || r.includes('rescue');
}
