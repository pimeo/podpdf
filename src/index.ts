import { PDF as BasePDF } from './lib/pdf'
import { SIZES } from './lib/constants'
import { Size } from './lib/types'

export class PDF extends BasePDF {
  producer: string = 'podpdf'

  /**
   * Save PDF in filesystem using FS promise or Bun.
   * @param {string} path - The path of the file to store the built file.
   */
  async save(path: string) {
    const d = this.build();
    if (typeof Bun !== 'undefined') {
      await Bun.write(path, d);
    } else {
      const { writeFile } = await import('fs/promises');
      await writeFile(path, d)
    }
  }
}

export const pdf = (s?: Size | keyof typeof SIZES) => new PDF(s)
