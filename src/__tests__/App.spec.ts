import { describe, it, expect } from 'vitest'

import HomeView from '../views/LoginView.vue'

describe('App', () => {
  it('keeps the application scaffold available', () => {
    expect(HomeView).toBeTruthy()
  })
})
