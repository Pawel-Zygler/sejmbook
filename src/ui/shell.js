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
  </nav>
  <main id="view" tabindex="-1"></main>
  <aside id="aside" aria-label="Kluby"></aside>
</div>
`;
