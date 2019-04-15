export const state = () => ({
  /**
   * Dark theme active.
   */
  isDark: false,
  sidenavIsOpen: undefined,
});

export const mutations = {
  toggleDark(state) {
    state.isDark = !state.isDark;
    document.cookie = `dark=${state.isDark}; expires=${new Date(Date.now() + 365*24*60*60*1000)};`
  },
  toggleSidenav(state) {
    state.sidenavIsOpen = !state.sidenavIsOpen;
  },
  setSidenav(state, value) {
    state.sidenavIsOpen = value;
  },
};
