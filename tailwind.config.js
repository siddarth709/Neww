
module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        paper: "#E9EBE4",       
        panel: "#F5F6F1",       
        ink: "#1B2430",         
        "ink-soft": "#4B5563",  
        line: "#C9CCC2",        
        verified: "#2F6B4F",    
        "verified-bg": "#E1EBE3",
        flagged: "#A3521C",     
        "flagged-bg": "#F3E6D8",
        pending: "#5B6472",
        accent: "#1B2430",      
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],   
        body: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"], 
      },
      fontSize: {
        hero: ["4.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        DEFAULT: "3px",   
      },
    },
  },
  plugins: [],
};
