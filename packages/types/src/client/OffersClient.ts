import { BaseClient } from './BaseClient'
import type { Offer, OfferDetailResponse } from '../Offer'
import type { CreateOfferInput, UpdateOfferInput, SaveResult } from '../Admin'

function buildOfferFormData(input: CreateOfferInput | UpdateOfferInput, slug?: string): FormData {
  const formData = new FormData()
  if (slug) formData.set('slug', slug)
  formData.set('title', input.title)
  formData.set('intro', input.intro ?? '')
  formData.set('category', input.category)
  formData.set('targetAudience', input.targetAudience ?? '')
  formData.set('schedule', input.schedule ?? '')
  formData.set('location', input.location ?? '')
  formData.set('mapsLink', input.mapsLink ?? '')
  formData.set('registration', input.registration ?? '')
  formData.set('organizers', JSON.stringify((input.organizers ?? []).filter((o) => o.name.trim())))
  formData.set('body', input.body ?? '')
  if (input.cardImage) formData.set('cardImage', input.cardImage)
  return formData
}

export class OffersClient extends BaseClient {
  list(): Promise<Offer[]> {
    return this.publicJson('/offers')
  }

  get(slug: string): Promise<OfferDetailResponse | null> {
    return this.publicJsonOrNull(`/offers/${slug}`)
  }

  create(input: CreateOfferInput): Promise<SaveResult> {
    return this.authedJson('/admin/offers', { method: 'POST', body: buildOfferFormData(input) })
  }

  update(slug: string, input: UpdateOfferInput): Promise<SaveResult> {
    return this.authedJson('/admin/offers', { method: 'POST', body: buildOfferFormData(input, slug) })
  }

  delete(slug: string): Promise<{ ok: true }> {
    return this.authedJson(`/admin/offers/${slug}`, { method: 'DELETE' })
  }

  importMdoc(file: File): Promise<SaveResult> {
    const formData = new FormData()
    formData.set('file', file)
    return this.authedJson('/admin/offers/import', { method: 'POST', body: formData })
  }
}
