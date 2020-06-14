<script>
  // components
  import Header from "./UI/Header.svelte";
  import Sidenav from "./UI/Sidenav.svelte";
  import BottomNav from "./components/BottomNav.svelte";
  // pages
  import Home from "./pages/Home.svelte";
  import About from "./pages/About.svelte";
  import Handwashing from "./pages/Handwashing.svelte";
  import Notes from "./pages/Notes.svelte";

  let links = [
    {
      name: "Shop",
      icon: `<i class="fas fa-shopping-cart" />`
    },
    {
      name: "Auction",
      icon: `<i class="fas fa-gavel" />`
    },
    {
      name: "Batteries",
      icon: `<i class="fas fa-car-battery" />`
    },
    {
      name: "Bids",
      icon: `<i class="fas fa-wallet" />`
    }
  ];

  let sidebar_show = false;
  let currentPage = window.location.pathname || "/";
</script>

<style>
  main {
    padding: 100px 20px 0px 20px;
  }
</style>

<Header
  on:click={() => (sidebar_show = !sidebar_show)}
  {currentPage}
  on:changePage={e => (currentPage = e.detail)} />
<Sidenav
  on:closeNav={() => (sidebar_show = false)}
  on:click={() => (sidebar_show = false)}
  bind:show={sidebar_show}
  {currentPage}
  on:changePage={e => changePage(e.detail)} />

<main>
  {#if currentPage === '/'}
    <Home />
  {:else if currentPage === '/about'}
    <About on:action={e => console.log(e.detail)} />
  {:else if currentPage === '/handwashing'}
    <Handwashing />
  {:else if currentPage === '/notes'}
    <Notes />
  {/if}
</main>

<BottomNav color="var(--prime)" bottomNavLinks={links} />
