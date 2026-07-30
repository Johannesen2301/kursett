import { useEffect } from 'react'

const BASE = 'https://kursett.no'

/**
 * Setter tittel, beskrivelse og strukturerte data per side.
 * Uten dette ser Google alle sider som "Kursett" uten innhold.
 */
export default function Seo({ tittel, beskrivelse, sti, ingenIndeksering, faq }) {
  useEffect(() => {
    document.title = tittel

    const settMeta = (navn, innhold, erProperty = false) => {
      const attr = erProperty ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${navn}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, navn)
        document.head.appendChild(el)
      }
      el.setAttribute('content', innhold)
    }

    settMeta('description', beskrivelse)
    settMeta('robots', ingenIndeksering ? 'noindex, nofollow' : 'index, follow')

    // Open Graph — for deling på Facebook, LinkedIn osv.
    settMeta('og:title', tittel, true)
    settMeta('og:description', beskrivelse, true)
    settMeta('og:type', 'website', true)
    settMeta('og:locale', 'nb_NO', true)
    if (sti) settMeta('og:url', BASE + sti, true)

    settMeta('twitter:card', 'summary')
    settMeta('twitter:title', tittel)
    settMeta('twitter:description', beskrivelse)

    // Canonical — hindrer at samme innhold teller som flere sider
    if (sti) {
      let link = document.querySelector('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
      }
      link.setAttribute('href', BASE + sti)
    }

    // Strukturerte data for FAQ — kan gi utvidet visning i Google
    const gammel = document.getElementById('faq-schema')
    if (gammel) gammel.remove()
    if (faq && faq.length) {
      const script = document.createElement('script')
      script.id = 'faq-schema'
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.sporsmal,
          acceptedAnswer: { '@type': 'Answer', text: f.svar },
        })),
      })
      document.head.appendChild(script)
    }
  }, [tittel, beskrivelse, sti, ingenIndeksering, faq])

  return null
}
