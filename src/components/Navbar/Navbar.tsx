import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BarChartIcon from '@mui/icons-material/BarChart';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import styles from './Navbar.module.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOut, isAdmin } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleMenuClose();
    setMobileDrawerOpen(false);
    await signOut();
    navigate('/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const userInitial = (displayName ? displayName.charAt(0).toUpperCase() : session?.user?.email?.charAt(0).toUpperCase()) || 'U';

  useEffect(() => {
    let mounted = true;
    const fetchName = async () => {
      if (!session?.user?.id) return;
      // Try profiles first
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (!mounted) return;
      if (prof?.display_name) {
        setDisplayName(prof.display_name);
        return;
      }
      // fallback to leaderboard
      const { data: lb } = await supabase.from('leaderboard').select('display_name').eq('user_id', session.user.id).single();
      if (!mounted) return;
      if (lb?.display_name) setDisplayName(lb.display_name);
    };
    fetchName();
    return () => { mounted = false; };
  }, [session?.user?.id]);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <HomeIcon /> },
    { label: 'My Predictions', path: '/my-predictions', icon: <SportsCricketIcon /> },
    { label: 'Leaderboard', path: '/leaderboard', icon: <BarChartIcon /> },
    { label: 'Rules', path: '/rules', icon: <MenuBookIcon /> },
    { label: 'Bonus Stage', path: '/bonus-stage', icon: <EmojiEventsIcon /> },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: <AdminPanelSettingsIcon /> }] : []),
  ];

  return (
    <>
      <AppBar position="sticky" className={styles.navbar}>
        <Toolbar className={styles.toolbar}>

          {/* ── Logo ── */}
          <Box className={styles.logoSection}>
            <Box className={styles.logo} onClick={() => navigate('/dashboard')}>
              <Box className={styles.logoIconContainer}>
                <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="18" fill="#000" />
                  <path d="M20 6 L26 14 L34 16 L28 23 L30 32 L20 28 L10 32 L12 23 L6 16 L14 14 Z" fill="#fff" opacity="0.15"/>
                  <circle cx="20" cy="20" r="10" stroke="#fff" strokeWidth="2" fill="none"/>
                  <circle cx="20" cy="20" r="5" fill="#fff" opacity="0.9"/>
                  <circle cx="20" cy="20" r="2" fill="#000"/>
                  <line x1="20" y1="2" x2="20" y2="10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                  <line x1="20" y1="30" x2="20" y2="38" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                  <line x1="2" y1="20" x2="10" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                  <line x1="30" y1="20" x2="38" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                </svg>
              </Box>
              <Box className={styles.brandInfo}>
                <Typography className={styles.brandName}>
                  <span style={{ color: '#fff' }}>sahi</span><span style={{ color: 'rgba(255,255,255,0.55)' }}>Predict</span>
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* ── Desktop Nav Links ── */}
          {!isMobile && (
            <Box className={styles.navLinks}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  className={`${styles.navButton} ${isActive(item.path) ? styles.active : ''}`}
                  startIcon={item.icon}
                  onClick={() => handleNavigation(item.path)}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          {/* ── Right Section ── */}
          <Box className={styles.rightSection}>
          {/* Desktop avatar → dropdown */}
            {!isMobile && (
              <Tooltip title={displayName || session?.user?.email || 'Account'}>
                <IconButton onClick={handleMenuOpen} className={styles.userButtonIcon} sx={{ ml: 0.25 }}>
                  <Avatar className={styles.avatar}>{userInitial}</Avatar>
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop dropdown */}
            {!isMobile && (
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ className: styles.menuPaper }}
                MenuListProps={{ className: styles.menuList }}
              >
                {/* Black header strip */}
                <Box className={styles.menuHeader}>
                  <Avatar className={styles.menuHeaderAvatar}>{userInitial}</Avatar>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography className={styles.menuHeaderEmail}>
                      {displayName || session?.user?.email}
                    </Typography>
                    <Typography className={styles.menuHeaderRole}>Member</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={handleLogout} className={styles.logoutMenuItem}>
                  <LogoutIcon className={styles.logoutIcon} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    Sign Out
                  </Typography>
                </MenuItem>
              </Menu>
            )}

            {/* Mobile hamburger */}
            {isMobile && (
              <IconButton onClick={() => setMobileDrawerOpen((v) => !v)} className={styles.hamburgerIcon}>
                {mobileDrawerOpen
                  ? <CloseIcon sx={{ fontSize: '1.4rem' }} />
                  : <MenuIcon sx={{ fontSize: '1.4rem' }} />}
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Mobile Drawer ── */}
      <Drawer
        anchor="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          className: styles.mobilePaper,
          sx: { top: { xs: '56px', sm: '60px' }, height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 60px)' } },
        }}
      >
        <Box className={styles.mobileDrawerContent}>

          {/* Nav list */}
          <List className={styles.mobileNavList}>
            {navItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={isActive(item.path)}
                  className={styles.mobileNavItem}
                >
                  <ListItemIcon className={styles.mobileNavIcon}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      sx: { fontWeight: 600, fontSize: '0.9rem', color: 'inherit' },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {/* User + logout */}
          <Box className={styles.mobileUserSection}>
                <Box className={styles.mobileUserCard}>
              <Avatar className={styles.mobileUserAvatar}>{userInitial}</Avatar>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName || session?.user?.email}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Member
                </Typography>
              </Box>
            </Box>
            <Button
              fullWidth
              variant="contained"
              startIcon={<LogoutIcon sx={{ fontSize: '1rem !important' }} />}
              onClick={handleLogout}
              className={styles.mobileLogoutButton}
            >
              Sign Out
            </Button>
          </Box>

        </Box>
      </Drawer>
    </>
  );
};

export default Navbar;
