import { PDF as BasePDF } from './lib/pdf'
import { SIZES } from './lib/constants'
import { Size } from './lib/types'

export class PDF extends BasePDF {

  /**
   * Download PDF in browser using Blob and URL APIs
   * @param filename - The filename for the downloaded PDF (default: 'document.pdf')
   */
  download(filename: string = 'document.pdf') {
    if (typeof window === 'undefined') {
      throw new Error('download() method is only available in browser environment. Use build() to get Uint8Array instead.')
    }

    const bytes = this.build()
    const blob = new Blob([bytes as any], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Get PDF as Blob object (useful for preview or custom handling)
   */
  toBlob(): Blob {
    const bytes = this.build()
    return new Blob([bytes as any], { type: 'application/pdf' })
  }

  /**
   * Get PDF as data URL (useful for iframe preview)
   */
  toDataURL(): string {
    const bytes = this.build()
    const blob = new Blob([bytes as any], { type: 'application/pdf' })
    return URL.createObjectURL(blob)
  }

}

export const pdf = (s?: Size | keyof typeof SIZES) => new PDF(s)
