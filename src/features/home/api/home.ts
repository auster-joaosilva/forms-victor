import { createServerFn } from '@tanstack/react-start'
import { publicBaseUrl, publicEvents } from '@/server/events/composition'
import type { HomeBootstrap } from '../types/home'

export const loadHome = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HomeBootstrap> => ({ ...(await publicEvents.home()), publicUrl: publicBaseUrl }),
)
