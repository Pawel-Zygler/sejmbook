/** Static page frame. Used by the build and by integration tests, so both see the same markup. */
export const SHELL_HTML = `
<header class="topbar">
  <div class="topbar-in">
    <a class="logo" href="#start" aria-label="Sejmbook, strona główna">sejmbook</a>
    <label class="top-search" for="top-search"><span class="visually-hidden">Szukaj posła</span>
      <input id="top-search" type="search" placeholder="Szukaj w Sejmbooku" data-action="top-search" autocomplete="off">
    </label>
    <nav class="topnav" aria-label="Główne">
      <a href="#start" data-nav="home">Start</a>
      <a href="#poslowie" data-nav="directory">Posłowie</a>
      <a href="#frequent-flyer" data-nav="flyer">Frequent Flyer</a>
    </nav>
  </div>
</header>
<div class="layout">
  <nav class="sidenav" aria-label="Sekcje">
    <a href="#start" data-nav="home"><span class="ico">⌂</span>Aktualności</a>
    <a href="#poslowie" data-nav="directory"><span class="ico">☷</span>Posłowie X kadencji</a>
    <p class="sidenav-label">Rankingi</p>
    <a href="#frequent-flyer" data-nav="flyer"><span class="ico">✈</span>Frequent Flyer</a>
    <p class="sidenav-note">Sejmbook to niezależny dashboard o Sejmie. Wkrótce: głosowania, frekwencja, wystąpienia.</p>
  </nav>
  <main id="view" tabindex="-1"></main>
  <aside id="aside" aria-label="Kluby"></aside>
</div>
`;
