import { readdir, readFile as readBytes } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureBucket, findHousePhoto, storeFile } from '../src/server/storage/composition'

const directory = 'prisma/seed-assets/house-photos'

await ensureBucket()
for (const name of (await readdir(directory)).filter((file) => file.endsWith('.jpg')).sort()) {
  if (await findHousePhoto(name)) {
    console.log(`já existe: ${name}`)
    continue
  }
  const bytes = new Uint8Array(await readBytes(join(directory, name)))
  const record = await storeFile({ kind: 'house_photo', contentType: 'image/jpeg', bytes, originalName: name })
  console.log(`enviada: ${name} -> ${record.id}`)
}
process.exit(0)
