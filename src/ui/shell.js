/** Static page frame. Used by the build and by integration tests, so both see the same markup. */
export const SHELL_HTML = `
<header class="topbar">
  <div class="topbar-in">
    <a class="logo" href="#start" aria-label="Sejmbook, strona główna"><span class="logo-name">sejmbook</span><span class="logo-tag" data-testid="logo-tag">wydarzenia w Rzeczypospolitej</span></a>
    <label class="top-search" for="top-search"><span class="visually-hidden">Szukaj posła</span>
      <input id="top-search" type="search" placeholder="Szukaj posła, ministra, prezydenta" data-action="top-search" autocomplete="off">
    </label>
    <nav class="topnav" aria-label="Główne">
      <a href="#start" data-nav="home">Feed</a>
      <a href="#poslowie" data-nav="directory">Posłowie</a>
      <a href="#panstwo" data-nav="state">Państwo</a>
      <a href="#frequent-flyer" data-nav="flyer" aria-label="Frequent Flyer"><span class="nav-long">Frequent </span>Flyer</a>
      <a href="#frekwencja" data-nav="attendance">Frekwencja</a>
    </nav>
    <div class="ui-switch" role="group" aria-label="Wersja wyglądu" data-testid="ui-switch">
      <button type="button" data-action="ui-skin" data-skin="classic" aria-pressed="true" title="Klasyczny wygląd"><span class="ui-long">Klasyczny</span><span class="ui-short" aria-hidden="true">1</span></button>
      <button type="button" data-action="ui-skin" data-skin="modern" aria-pressed="false" title="Nowoczesny wygląd"><span class="ui-long">Nowoczesny</span><span class="ui-short" aria-hidden="true">2</span></button>
    </div>
    <button type="button" class="theme-btn" data-action="theme" data-testid="theme-btn" aria-label="Motyw: automatyczny" title="Motyw: automatyczny"></button>
  </div>
</header>
<div class="layout">
  <nav class="sidenav" aria-label="Sekcje">
    <a href="#start" data-nav="home"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg></span>Feed</a>
    <a href="#poslowie" data-nav="directory"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.4c2.4-.3 4.3 1.3 4.8 4.6"/></svg></span>Posłowie X kadencji</a>
    <a href="#panstwo" data-nav="state"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20.5h18M4.5 9.5h15M12 3.5 4 8h16z"/><path d="M6.5 9.5v8.5M10 9.5v8.5M14 9.5v8.5M17.5 9.5v8.5"/></svg></span>Państwo i rządy</a>
    <p class="sidenav-label">Rankingi</p>
    <a href="#frequent-flyer" data-nav="flyer"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5 4 11l1.5-1.5 7 .5 4.2-4.2c.9-.9 2.4-.9 3.1-.2s.7 2.2-.2 3.1L15.4 13l.5 7-1.5 1.5-2.5-6.5"/><path d="m7 17-3 .5.5-3"/></svg></span>Frequent Flyer</a>
    <a href="#frekwencja" data-nav="attendance"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12h8.5"/></svg></span>Frekwencja</a>
    <a href="#partie" data-nav="parties"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg></span>Najwięcej partii</a>
    <p class="sidenav-label">Serwis</p>
    <a href="#changelog" data-nav="changelog"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7.5V12l3 2"/><circle cx="12" cy="12" r="8.5"/></svg></span>Changelog</a>
    <a href="#mapa" data-nav="sitemap"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="4.5" rx="1"/><rect x="3" y="16" width="6" height="4.5" rx="1"/><rect x="15" y="16" width="6" height="4.5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></svg></span>Mapa strony</a>
  </nav>
  <main id="view" tabindex="-1"></main>
  <aside id="aside" aria-label="Kluby"></aside>
</div>
<footer class="site-foot" data-testid="site-foot">
  <div class="foot-in">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="logo" href="#start" aria-label="Sejmbook, strona główna"><span class="logo-name">sejmbook</span><span class="logo-tag">wydarzenia w Rzeczypospolitej</span></a>
        <p>Co robią posłowie, rząd i urzędy III RP. Tylko oficjalne i sprawdzone źródła.</p>
      </div>
      <nav class="foot-col" aria-label="Sekcje w stopce">
        <p class="foot-h">Sekcje</p>
        <a href="#start">Feed</a>
        <a href="#poslowie">Posłowie</a>
        <a href="#panstwo">Państwo i rządy</a>
      </nav>
      <nav class="foot-col" aria-label="Rankingi w stopce">
        <p class="foot-h">Rankingi</p>
        <a href="#frequent-flyer">Frequent Flyer</a>
        <a href="#frekwencja">Frekwencja</a>
        <a href="#partie">Najwięcej partii</a>
      </nav>
      <nav class="foot-col" aria-label="Serwis w stopce">
        <p class="foot-h">Serwis</p>
        <a href="#changelog">Changelog</a>
        <a href="#mapa">Mapa strony</a>
      </nav>
    </div>
    <p class="foot-src"><b>Źródła danych:</b> API Sejmu (posłowie, kadencje III–X, kluby, głosowania, interpelacje), polska Wikipedia (posłowie I–II kadencji, rządy i urzędy III RP), Wikidata (partie, życiorysy i konta w mediach społecznościowych), polska Wikipedia (działalność społeczna posłów), Wikimedia Commons (zdjęcia urzędników), oficjalne strony urzędów (prezydent.pl, gov.pl, senat.gov.pl, nik.gov.pl) i media (loty posłów). Klub posła to ostatni klub w danej kadencji.</p>
    <p class="foot-bottom">Sejmbook · wydarzenia w Rzeczypospolitej</p>
  </div>
</footer>
`;
