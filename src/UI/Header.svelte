<script>
  import page from 'page.js'
  import { createEventDispatcher } from "svelte";
  let navLinks = ["Home", "About", "Handwashing", "Notes", "Contact"];

  let routeLinks = [
    {
      name: "Home",
      path: '/'
    },
    {
      name: "About",
      path: '/about'
    },
    {
      name: "Handwashing",
      path: '/handwashing'
    },
    {
      name: "Notes",
      path: '/notes'
    },
    {
      name: "Contact",
      path: '/contact'
    },
  ]
  export let currentPage;

  const dispatch = createEventDispatcher();

  function navigate (ctx, next) {
    console.log(`navigate to: ${ctx.path}`);
    dispatch("changePage", ctx.path)
    
  }

  page('/', navigate)
  page('/about', navigate)
  page('/notes', navigate)
  page('/handwashing', navigate)
  page('/contact', navigate)

  page.start()

  const changePage = e => {
    dispatch("changePage", e);
  };
</script>

<style>
  .header {
    width: 100%;
    background: #f7f7f7;
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    justify-content: center;
    z-index: 222;
  }

  .h-container {
    width: 80vw;
    margin: 0 auto;
    height: 80px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
  }
  nav ul {
    height: 80px;
    display: flex;
    place-items: center;
  }

  nav ul li {
    list-style-type: none;
    display: inline-block;
    margin-left: 50px;
    height: 100%;
    display: flex;
    place-items: center;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: 0.3s ease;
  }

  nav ul li:hover {
    color: #e9a528;
  }

  .active {
    color: #e9a528;
    border-bottom-color: #e9a528;
  }
  .burger {
    width: 50px;
    height: 50px;
    padding: 6px;
    display: none;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .burger div {
    width: 100%;
    height: 4px;
    border-radius: 20px;
    background: #363636;
  }

  @media screen and (max-width: 700px) {
    nav {
      display: none;
    }
    .header .burger {
      display: flex !important;
    }
  }
</style>

<div class="header">
  <div class="h-container">
    <div class="logo">
      <span>
        <h3>simmedia</h3>
      </span>
    </div>
    <nav>
      <ul>
        {#each routeLinks as link}
          <a
            style="margin-left: 20px"
            class:active={currentPage === link.path}
            href={link.path}>
            {link.name}
          </a>
        {/each}
      </ul>
<!-- 
      <ul>
        {#each routeLinks as link}
          <li
            class:active={currentPage === link.name}
            on:click={() => changePage(link.path)}>
            {link.name}
          </li>
        {/each}
      </ul> -->
    </nav>
    <div class="burger" on:click>
      <div />
      <div />
      <div />
    </div>
  </div>
</div>
