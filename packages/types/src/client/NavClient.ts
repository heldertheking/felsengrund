import { BaseClient } from './BaseClient'
import type { NavGroup } from '../Nav'

export class NavClient extends BaseClient {
  list(): Promise<NavGroup[]> {
    return this.publicJson('/nav')
  }
}
