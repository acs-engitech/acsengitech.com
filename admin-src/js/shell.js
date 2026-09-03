// admin-src/js/shell.js
export function adminShell() {
  return {
    sidebarOpen: false,
    activeTab: 'overview',
    selectTab(tab) {
      this.activeTab = tab;
      if (window.matchMedia('(max-width: 860px)').matches) this.sidebarOpen = false;
    },
  };
}
