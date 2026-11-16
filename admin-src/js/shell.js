// admin-src/js/shell.js
export function adminShell() {
  return {
    sidebarOpen: false,
    activeTab: 'overview',
    titles: { overview: 'Overview', seo: 'SEO manager', blogs: 'Blog manager', positions: 'Positions', enquiries: 'Enquiries', applications: 'Applications', partners: 'Partners', analytics: 'Analytics', settings: 'Robots.txt', llms: 'LLMs.txt' },
    get title() { return this.titles[this.activeTab] || 'Admin'; },
    selectTab(tab) {
      this.activeTab = tab;
      if (window.matchMedia('(max-width: 860px)').matches) this.sidebarOpen = false;
    },
  };
}
