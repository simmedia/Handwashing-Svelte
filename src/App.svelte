<script>
  import Header from "./UI/Header.svelte";
  import Sidenav from "./UI/Sidenav.svelte";

  import Home from "./pages/Home.svelte";
  import About from "./pages/About.svelte";
  import Handwashing from "./pages/Handwashing.svelte";
  import Notes from "./pages/Notes.svelte";

  let sidebar_show = false;
  let currentPage = "Home";

const changePage = (e) => {
  currentPage = e
  sidebar_show = false;
}
  
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 90px auto 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>

<Header
  on:click={() => (sidebar_show = !sidebar_show)}
  {currentPage}
  on:changePage={e => (currentPage = e.detail)} />
<Sidenav on:closeNav={()=> sidebar_show = false} bind:show={sidebar_show} {currentPage} on:changePage={e => changePage(e.detail)} />



<main>
  {#if currentPage === 'Home'}
    <Home />
  {:else if currentPage === 'About'}
    <About on:action={e => console.log(e.detail)} />
  {:else if currentPage === 'Handwashing'}
    <Handwashing />
  {:else if currentPage === 'Notes'}
    <Notes />
  {/if}
</main>
