import { z } from "zod";

const maybeUrl = z.string().trim().url().optional().or(z.literal(""));

export const setupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const propertyCreateSchema = z.object({
  codeIsr: z.string().min(2).max(100),
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(100),
  district: z.string().max(120).optional(),
  monthlyPrice: z.coerce.number().int().nonnegative(),
  propertyType: z.string().min(2).max(80),
  bedrooms: z.coerce.number().int().min(0).max(10),
  availableFrom: z.string().optional(),
  petsAllowed: z.coerce.boolean(),
  petsDetails: z.string().max(300).optional(),
  parking: z.coerce.boolean(),
  inclusions: z.string().max(600).optional(),
  descriptionFr: z.string().min(10).max(2000),
  descriptionEn: z.string().min(10).max(2000),
  photoLinks: z.array(z.object({ url: z.string().url(), description: z.string().optional() })).default([]),
  gestionIsrUrl: maybeUrl,
  marketplaceUrl: maybeUrl,
  facebookPostUrl: maybeUrl,
  marketingPriority: z.coerce.number().int().min(1).max(5).default(3),
  lastVerificationDate: z.string().optional(),
  status: z
    .enum(["AVAILABLE", "VISIT_SCHEDULED", "RESERVED", "RENTED", "REMOVED", "TO_VERIFY"])
    .default("AVAILABLE"),
});

export const propertyFilterSchema = z.object({
  city: z.string().optional(),
  district: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  bedrooms: z.coerce.number().optional(),
  status: z.string().optional(),
  query: z.string().optional(),
});

export const prospectCreateSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  email: z.string().email().optional().or(z.literal("")),
  messengerUrl: maybeUrl,
  preferredLanguage: z.enum(["fr", "en"]).default("fr"),
  maxBudget: z.coerce.number().int().positive().optional(),
  preferredDistricts: z.array(z.string().min(1)).default([]),
  bedroomsNeeded: z.coerce.number().int().min(0).max(10).optional(),
  moveInDate: z.string().optional(),
  hasPets: z.coerce.boolean().default(false),
  needsParking: z.coerce.boolean().default(false),
  jobTitle: z.string().max(120).optional(),
  firstContactPropertyId: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().max(1500).optional(),
  status: z
    .enum([
      "NEW",
      "TO_CONTACT",
      "QUALIFIED",
      "PROPERTIES_PROPOSED",
      "VISIT_REQUESTED",
      "VISIT_CONFIRMED",
      "FILE_SUBMITTED",
      "ACCEPTED",
      "PLACED",
      "REFUSED",
      "INACTIVE",
    ])
    .default("NEW"),
});

export const interactionSchema = z.object({
  prospectId: z.string().min(1),
  type: z.enum(["PHONE", "EMAIL", "MESSENGER", "SMS", "IN_PERSON", "OTHER"]),
  summary: z.string().min(4).max(1000),
});

export const visitCreateSchema = z.object({
  prospectId: z.string().min(1),
  propertyId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().max(120).optional(),
});

export const publicVisitSubmissionSchema = z.object({
  prospect: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(7).max(30),
    email: z.string().email().optional().or(z.literal("")),
    preferredLanguage: z.enum(["fr", "en"]).default("fr"),
    maxBudget: z.coerce.number().int().positive().optional(),
    preferredDistricts: z.array(z.string().min(1)).default([]),
    bedroomsNeeded: z.coerce.number().int().min(0).max(10).optional(),
    moveInDate: z.string().optional(),
    occupantsCount: z.coerce.number().int().min(1).max(12).optional(),
    hasPets: z.coerce.boolean().default(false),
    needsParking: z.coerce.boolean().default(false),
    availabilityNotes: z.string().max(1000).optional(),
    notes: z.string().max(1500).optional(),
  }),
  visit: z.object({
    propertyId: z.string().min(1),
    rentalUnitId: z.string().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const visitApprovalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export const availableSlotsSchema = z.object({
  propertyId: z.string().min(1),
  prospectId: z.string().min(1),
  rangeStart: z.string().datetime(),
  rangeEnd: z.string().datetime(),
});

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const visitAvailabilitySettingsSchema = z.object({
  timeZone: z.string().min(1).optional(),
  visitDurationMinutes: z.number().int().min(15).max(180).optional(),
  bufferMinutes: z.number().int().min(0).max(180).optional(),
  minLeadHours: z.number().int().min(0).max(168).optional(),
  maxVisitsPerEvening: z.number().int().min(1).max(20).optional(),
  weekSchedule: z.object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  }).optional(),
});

export const visitBlockedPeriodCreateSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(400).optional(),
});

export const visitMutationSchema = z.object({
  action: z.enum(["RESCHEDULE", "CANCEL", "COMPLETE", "NO_SHOW", "ADD_NOTE"]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

export const advertisementApprovalSchema = z.object({
  action: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT", "CANCEL_APPROVAL", "MANUAL_REQUIRED"]),
  notes: z.string().max(1000).optional(),
});

export const approveAllContentsSchema = z.object({
  propertyId: z.string().min(1),
  confirm: z.literal(true),
});

export const publishPageSchema = z.object({
  idempotencyKey: z.string().min(8).max(160),
});

export const marketplacePublishSchema = z.object({
  publicationUrl: z.string().url(),
  checklist: z.object({
    prix: z.boolean(),
    adresse: z.boolean(),
    chambres: z.boolean(),
    disponibilite: z.boolean(),
    animaux: z.boolean(),
    stationnement: z.boolean(),
    photos: z.boolean(),
    coordonnees: z.boolean(),
  }),
});

export const facebookGroupSchema = z.object({
  name: z.string().min(2).max(200),
  link: z.string().url(),
  city: z.string().max(120).optional(),
  sectors: z.array(z.string().max(120)).default([]),
  language: z.string().max(20).optional(),
  active: z.boolean().default(true),
  isMember: z.boolean().default(false),
  isAdminOrModerator: z.boolean().default(false),
  rules: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  minDelayHours: z.number().int().min(1).max(720).default(24),
});

export const groupPublicationSchema = z.object({
  groupId: z.string().min(1),
  publicationUrl: z.string().url().optional(),
  customText: z.string().max(4000).optional(),
  status: z.enum(["PENDING", "MANUAL_ACTION_REQUIRED", "PUBLISHED", "FAILED"]),
});

export const advertisementPhotoSelectionSchema = z.object({
  channel: z.enum(["PAGE", "MARKETPLACE", "FACEBOOK_GROUP"]),
  items: z.array(
    z.object({
      propertyPhotoId: z.string().min(1),
      sortOrder: z.number().int().min(0),
      isPrimary: z.boolean().optional(),
      excluded: z.boolean().optional(),
    }),
  ).min(1),
});

export const placementCreateSchema = z.object({
  prospectId: z.string().min(1),
  propertyId: z.string().min(1),
  visitId: z.string().optional(),
  visitDate: z.string().optional(),
  sentToColleaguesDate: z.string().optional(),
  acceptanceDate: z.string().optional(),
  signatureDate: z.string().optional(),
  moveInDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});