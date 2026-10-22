import { Router } from 'express';
import type { ServiceCategoryDto, ServiceDto } from '@fixnow/shared';
import { query } from '../db/pool';

export const catalogRouter = Router();

export function toServiceDto(s: any): ServiceDto {
  return {
    id: s.id, categoryId: s.category_id, nameEn: s.name_en, nameKm: s.name_km,
    descriptionEn: s.description_en, descriptionKm: s.description_km,
    minPrice: s.min_price, maxPrice: s.max_price, status: s.status,
  };
}

export async function loadCatalog(includeAll: boolean): Promise<ServiceCategoryDto[]> {
  const cats = (await query(`SELECT * FROM service_categories ORDER BY sort_order, name_en`)).rows;
  const services = (await query(`SELECT * FROM services ${includeAll ? '' : `WHERE status = 'ACTIVE'`} ORDER BY name_en`)).rows;
  return cats.map((c) => ({
    id: c.id, code: c.code, nameEn: c.name_en, nameKm: c.name_km, icon: c.icon, status: c.status, sortOrder: c.sort_order,
    services: services.filter((s) => s.category_id === c.id).map(toServiceDto),
  }));
}

/** Public catalogue: categories (incl. Coming soon) and their active services. */
catalogRouter.get('/services', async (_req, res) => {
  res.json({ items: await loadCatalog(false) });
});
