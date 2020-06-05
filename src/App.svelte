<script>
  import Header from "./UI/Header.svelte";
  import About from "./pages/About.svelte";
  import Handwashing from './pages/Handwashing.svelte'
  import Notes from './pages/Notes.svelte'


  let currentPage = 'Home';
</script>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
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

<Header {currentPage} on:changePage={(e) => currentPage = e.detail} />
<main>
{#if currentPage === 'Home'}
    <div>Home Page</div>
{:else if currentPage === 'About'}
	<About on:action={(e) => console.log(e.detail)} />
{:else if currentPage === 'Handwashing'}
  <Handwashing />
{:else if currentPage === 'Notes'}
  <Notes />
{/if}
</main>
