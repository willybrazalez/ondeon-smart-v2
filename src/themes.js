export const environments = {
  mainDark: {
    id: 'mainDark',
    name: 'Ondeón',
    isDark: true,
    colors: {
      '--background': '220 10% 10%', // gris oscuro
      '--foreground': '220 10% 92%', // texto gris claro
      '--foreground-rgb': '230, 230, 235',
      '--card': '220 10% 14%',
      '--card-foreground': '220 10% 92%',
      '--card-rgb': '40, 42, 48',
      '--popover': '220 10% 12%',
      '--popover-foreground': '220 10% 92%',
      '--primary': '220 10% 60%', // gris medio
      '--primary-rgb': '140, 145, 155',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '220 10% 30%',
      '--secondary-rgb': '70, 75, 85',
      '--secondary-foreground': '0 0% 100%',
      '--muted': '220 10% 20%',
      '--muted-foreground': '220 10% 60%',
      '--accent': '220 10% 80%', // gris claro
      '--accent-rgb': '210, 210, 220',
      '--accent-foreground': '220 10% 20%',
      '--destructive': '0 70% 60%',
      '--destructive-foreground': '0 0% 100%',
      '--border': '220 10% 25%',
      '--input': '220 10% 16%',
      '--ring': '220 10% 70%',
    },
    dynamicBackgroundPalettes: [
      { main: "hsla(220, 10%, 20%, 0.18)", accent: "hsla(220, 10%, 30%, 0.12)", surreal: "hsla(220, 10%, 10%, 0.10)" }
    ],
    dynamicBackgroundPaused: { main: "hsla(220, 10%, 15%, 0.10)", accent: "hsla(220, 10%, 20%, 0.08)", surreal: "hsla(220, 10%, 8%, 0.07)" },
  }
};

export const applyEnvironment = () => {
  const environment = environments.mainDark;
  const root = document.documentElement;
  Object.entries(environment.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.classList.add('dark');
  localStorage.setItem('ondeon-smart-environment', 'mainDark');
  const event = new CustomEvent('ondeonEnvironmentApplied', { detail: { environmentId: 'mainDark' } });
  window.dispatchEvent(event);
  return environment;
};

export const getInitialEnvironment = () => applyEnvironment();
