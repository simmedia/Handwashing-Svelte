<script>
  import Header from "./UI/Header.svelte";
  import Sidenav from "./UI/Sidenav.svelte";


  import Home from "./pages/Home.svelte";
  import About from "./pages/About.svelte";
  import Handwashing from "./pages/Handwashing.svelte";
  import Notes from "./pages/Notes.svelte";

  let sidebar_show = false;
  let currentPage = window.location.pathname || "/";

</script>

<style>
main {
  padding-top: 100px;
}
</style>

<Header
  on:click={() => (sidebar_show = !sidebar_show)}
  {currentPage}
  on:changePage={e => (currentPage = e.detail)} />
<Sidenav on:click={()=> sidebar_show = false} bind:show={sidebar_show} {currentPage} on:changePage={e => changePage(e.detail)} />


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