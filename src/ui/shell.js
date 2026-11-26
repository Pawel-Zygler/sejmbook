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
    <a href="#start" data-nav="home"><span class="ico">⌂</span>Feed</a>
    <a href="#poslowie" data-nav="directory"><span class="ico">☷</span>Posłowie X kadencji</a>
    <a href="#panstwo" data-nav="state"><span class="ico">⚖</span>Państwo i rządy</a>
    <p class="sidenav-label">Rankingi</p>
    <a href="#frequent-flyer" data-nav="flyer"><span class="ico">✈</span>Frequent Flyer</a>
    <a href="#frekwencja" data-nav="attendance"><span class="ico">◔</span>Frekwencja</a>
    <a href="#partie" data-nav="parties"><span class="ico">⇄</span>Najwięcej partii</a>
    <p class="sidenav-label">Serwis</p>
    <a href="#changelog" data-nav="changelog"><span class="ico">✎</span>Changelog</a>
    <a href="#mapa" data-nav="sitemap"><span class="ico">⌗</span>Mapa strony</a>
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
