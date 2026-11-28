// "Mapa strony": every section and level of Sejmbook on one page, with links, for easier navigation.
import { esc, plural, pageHead, personHref } from './render.js';
import { currentHolders } from '../lib/government.js';

const link = (href, label, note = '') => `<li><a href="${esc(href)}">${esc(label)}</a>${note ? ` <small class="muted">${note}</small>` : ''}</li>`;

export function renderSitemap(ctx) {
  const g = ctx.gov;
  const today = ctx.today ?? ctx.fetchedAt?.slice(0, 10);
  const active = ctx.mps.filter((m) => m.active !== false).length;
  const former = ctx.peopleByKey ? [...ctx.peopleByKey.values()].filter((p) => !p.current).length : 0;
  const offices = g ? g.offices.map((o) => {
    const h = currentHolders(o, today)[0];
    return link('#panstwo', o.title, h ? `<a href="${esc(personHref(ctx, h.name))}">${esc(h.name)}</a>` : '');
  }).join('') : '';
  const govs = g ? [...g.governments].reverse().map((x) => link(`#rzad-${x.id}`, x.name, `${esc(String(x.from).slice(0, 4))}–${x.to ? esc(String(x.to).slice(0, 4)) : 'dziś'}`)).join('') : '';
  return `
  <section class="feed sitemap" data-view="sitemap">
    ${pageHead({ icon: '⌗', eyebrow: 'Serwis', title: 'Mapa strony', lede: 'Wszystkie sekcje Sejmbooku w jednym miejscu. Każdy profil, czy posła, czy urzędnika, ma ten sam układ.' })}
    <div class="sitemap-grid" data-testid="sitemap">
      <div class="panel"><h2><a href="#start">Feed</a></h2><ul>
        ${link('#start', 'Prezydent RP', 'komunikaty z prezydent.pl')}
        ${link('#start', 'Premier', 'komunikaty z gov.pl i Bluesky')}
        ${link('#start', 'Komunikaty urzędów', 'ministerstwa, Senat, NIK')}
        ${link('#start', 'Sejm: ostatnie głosowania', 'z wynikami klubów')}
        ${link('#start', 'Posłowie: interpelacje i zapytania', 'API Sejmu')}
      </ul></div>
      <div class="panel"><h2><a href="#poslowie">Posłowie</a></h2><ul>
        ${link('#poslowie', 'Posłowie X kadencji', `${active} w Sejmie dziś`)}
        ${link('#poslowie', 'Posłowie dawnych kadencji', former ? `${former} ${plural(former, 'osoba', 'osoby', 'osób')}, kadencje I–IX` : 'kadencje I–IX')}
        ${link('#poslowie', 'Szukaj posła, ministra, prezydenta')}
      </ul></div>
      <div class="panel"><h2>Rankingi</h2><ul>
        ${link('#frequent-flyer', 'Frequent Flyer', 'loty na koszt Sejmu')}
        ${link('#frekwencja', 'Frekwencja', 'obecność na głosowaniach')}
        ${link('#partie', 'Najwięcej partii', 'kto zmieniał kluby')}
        ${link('#konieczny', 'Cywilizacja łacińska', 'eksperyment: cztery zasady Konecznego')}
        ${link('#za-przeciw', 'Za i przeciw', 'kto najczęściej głosuje za, a kto przeciw')}
      </ul></div>
      <div class="panel"><h2>Serwis</h2><ul>
        ${link('#changelog', 'Changelog', 'każda zmiana w jednym zdaniu')}
        ${link('#mapa', 'Mapa strony')}
      </ul></div>
      ${g ? `<div class="panel"><h2><a href="#panstwo">Państwo: najważniejsze urzędy</a></h2><ul>${offices}</ul></div>
      <div class="panel"><h2><a href="#panstwo">Państwo: rządy III RP</a></h2><ul class="sitemap-cols">${govs}</ul></div>` : ''}
    </div>
  </section>`;
}
