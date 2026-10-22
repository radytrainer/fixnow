import { Router } from 'express';
import { z } from 'zod';
import type { Me } from '@fixnow/shared';
import { one, query, tx } from '../db/pool';
import { authenticate, currentUser, maskPhone } from '../http/auth';
import { badRequest, forbidden } from '../http/errors';
import { ALLOWED_MIME, saveBase64, signedUrl } from '../storage';

export const meRouter = Router();
meRouter.use(authenticate);

export async function loadMe(userId: string): Promise<Me> {
  const u = await one(`SELECT * FROM users WHERE id = $1`, [userId]);
  const me: Me = {
    id: u.id, role: u.role, name: u.name, phone: maskPhone(u.phone_e164),
    preferredLanguage: u.preferred_language, isDemoAccount: u.is_demo_account,
  };
  if (u.role === 'CUSTOMER') {
    const c = await one(`SELECT * FROM customer_profiles WHERE user_id = $1`, [userId]);
    me.customerProfile = c ? {
      homeAddressText: c.home_address_text, homeArea: c.home_area,
      homeLat: c.home_lat === null ? null : Number(c.home_lat), homeLng: c.home_lng === null ? null : Number(c.home_lng),
    } : null;
  }
  if (u.role === 'TECHNICIAN') {
    const t = await one(`SELECT * FROM technician_profiles WHERE user_id = $1`, [userId]);
    const services = t ? (await query(`SELECT service_id FROM technician_services WHERE technician_id = $1`, [t.id])).rows : [];
    me.technicianProfile = t ? {
      id: t.id, status: t.status, isAvailable: t.is_available, bio: t.bio, yearsExperience: t.years_experience,
      serviceArea: t.service_area, certificateSummary: t.certificate_summary, idDocumentNumber: t.id_document_number,
      hasIdDocument: !!t.id_document_key, hasCertificate: !!t.certificate_key, photoUrl: signedUrl(t.public_photo_key),
      rejectionReason: t.rejection_reason, serviceIds: services.map((s) => s.service_id),
    } : null;
  }
  return me;
}

meRouter.get('/me', async (req, res) => {
  res.json(await loadMe(currentUser(req).id));
});

meRouter.patch('/me', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    preferredLanguage: z.enum(['en', 'km']).optional(),
    homeAddressText: z.string().trim().max(300).nullable().optional(),
    homeArea: z.string().trim().max(80).nullable().optional(),
    homeLat: z.number().min(-90).max(90).nullable().optional(),
    homeLng: z.number().min(-180).max(180).nullable().optional(),
  }).strict().parse(req.body);
  const hasHome = ['homeAddressText', 'homeArea', 'homeLat', 'homeLng'].some((k) => k in body);
  if (hasHome && user.role !== 'CUSTOMER') throw forbidden('Only customers have a home location');
  await tx(async (db) => {
    if (body.name !== undefined || body.preferredLanguage !== undefined) {
      await db.query(
        `UPDATE users SET name = COALESCE($2, name), preferred_language = COALESCE($3, preferred_language), updated_at = now() WHERE id = $1`,
        [user.id, body.name ?? null, body.preferredLanguage ?? null],
      );
    }
    if (hasHome) {
      await db.query(
        `INSERT INTO customer_profiles (user_id, home_address_text, home_area, home_lat, home_lng) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           home_address_text = CASE WHEN $6 THEN EXCLUDED.home_address_text ELSE customer_profiles.home_address_text END,
           home_area = CASE WHEN $7 THEN EXCLUDED.home_area ELSE customer_profiles.home_area END,
           home_lat = CASE WHEN $8 THEN EXCLUDED.home_lat ELSE customer_profiles.home_lat END,
           home_lng = CASE WHEN $8 THEN EXCLUDED.home_lng ELSE customer_profiles.home_lng END,
           updated_at = now()`,
        [user.id, body.homeAddressText ?? null, body.homeArea ?? null, body.homeLat ?? null, body.homeLng ?? null,
          'homeAddressText' in body, 'homeArea' in body, 'homeLat' in body || 'homeLng' in body],
      );
    }
  });
  res.json(await loadMe(user.id));
});

/** Uploads a private file. Returns a media id the caller later attaches to a booking, warranty or profile. */
meRouter.post('/uploads', async (req, res) => {
  const user = currentUser(req);
  const body = z.object({
    purpose: z.enum(['PROBLEM', 'COMPLETION', 'WARRANTY', 'ID_DOCUMENT', 'CERTIFICATE', 'PROFILE_PHOTO']),
    mimeType: z.string().refine((m) => m in ALLOWED_MIME, 'Unsupported file type'),
    dataBase64: z.string().min(10),
  }).parse(req.body);
  const techOnly = ['COMPLETION', 'ID_DOCUMENT', 'CERTIFICATE', 'PROFILE_PHOTO'];
  const customerOnly = ['PROBLEM', 'WARRANTY'];
  if (techOnly.includes(body.purpose) && user.role !== 'TECHNICIAN') throw forbidden('Only technicians can upload this file');
  if (customerOnly.includes(body.purpose) && user.role !== 'CUSTOMER') throw forbidden('Only customers can upload this file');
  if (body.mimeType === 'application/pdf' && !['ID_DOCUMENT', 'CERTIFICATE'].includes(body.purpose)) throw badRequest('PDF is only accepted for documents');
  const saved = saveBase64(body.dataBase64, body.mimeType);
  const row = await one(
    `INSERT INTO booking_media (uploaded_by, media_type, mime_type, size_bytes, storage_key, purpose)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, media_type, created_at`,
    [user.id, saved.mediaType, body.mimeType, saved.size, saved.key, body.purpose],
  );
  res.status(201).json({ id: row.id, mediaType: row.media_type, url: signedUrl(saved.key), sizeBytes: saved.size });
});
