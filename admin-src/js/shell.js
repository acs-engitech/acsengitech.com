// admin-src/js/shell.js
export function adminShell() {
  return {
    sidebarOpen: false,
    activeTab: 'overview',
    titles: { overview: 'Overview', seo: 'SEO manager', blogs: 'Blog manager', team: 'Team', positions: 'Positions', enquiries: 'Enquiries', applications: 'Applications', partners: 'Partners', analytics: 'Analytics', settings: 'Robots.txt', llms: 'LLMs.txt' },
    subtitles: { overview: 'Here is what is happening on acsengitech.com', seo: 'Titles, descriptions and structured data for every page', blogs: 'Draft, schedule and publish articles', team: 'Members shown on the About page', positions: 'Open roles and internships', enquiries: 'Messages from the contact form', applications: 'Job applications and their status', partners: 'Vendor and agency registrations', analytics: 'First-party traffic and Google tags', settings: 'Crawler rules and sitemap', llms: 'Summary for AI assistants' },
    get subtitle() { return this.subtitles[this.activeTab] || ''; },
    get title() { return this.titles[this.activeTab] || 'Admin'; },
    selectTab(tab) {
      this.activeTab = tab;
      if (window.matchMedia('(max-width: 860px)').matches) this.sidebarOpen = false;
    },
  };
}
