import React, { useState } from 'react';
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
  Badge,
  Tooltip,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../../context/AuthContext';
import styles from './Navbar.module.css';

/**
 * Navigation bar component with Google-inspired design
 * Features: Professional Material Design, responsive layout, user menu
 * Mobile-friendly with hamburger menu
 */
const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

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

  const handleDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  /**
   * Determines if a nav link is active
   */
  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  const userInitial = session?.user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <AppBar position="sticky" className={styles.navbar}>
        <Toolbar className={styles.toolbar}>
          {/* Logo/Brand Section */}
          <Box className={styles.logoSection}>
            <Box className={styles.logo} onClick={() => navigate('/dashboard')}>
              <Box className={styles.logoIconContainer}>
                <EmojiEventsIcon className={styles.logoIcon} />
              </Box>
              <Box className={styles.brandInfo}>
                <Typography variant="h6" className={styles.brandName}>
                  Cricket
                </Typography>
                <Typography variant="caption" className={styles.brandSubtitle}>
                  Predictions
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Desktop Navigation Links */}
          {!isMobile && (
            <Box className={styles.navLinks}>
              <Button
                color="inherit"
                className={`${styles.navButton} ${
                  isActive('/dashboard') ? styles.active : ''
                }`}
                startIcon={<HomeIcon sx={{ fontSize: '1.3rem' }} />}
                onClick={() => handleNavigation('/dashboard')}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                className={`${styles.navButton} ${
                  isActive('/leaderboard') ? styles.active : ''
                }`}
                startIcon={<EmojiEventsIcon sx={{ fontSize: '1.3rem' }} />}
                onClick={() => handleNavigation('/leaderboard')}
              >
                Leaderboard
              </Button>
            </Box>
          )}

          {/* Right Section: Actions & User Menu */}
          <Box className={styles.rightSection}>
            {/* Notification Icon */}
            {!isMobile && (
              <Tooltip title="Notifications">
                <IconButton color="inherit" className={styles.iconButton}>
                  <Badge badgeContent={3} color="error">
                    <NotificationsIcon sx={{ fontSize: '1.3rem' }} />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            {/* Settings Icon */}
            {!isMobile && (
              <Tooltip title="Settings">
                <IconButton color="inherit" className={styles.iconButton}>
                  <SettingsIcon sx={{ fontSize: '1.3rem' }} />
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop User Menu */}
            {!isMobile && (
              <Tooltip title={session?.user?.email || 'User'}>
                <IconButton
                  onClick={handleMenuOpen}
                  className={styles.userButtonIcon}
                  sx={{ ml: 0.5 }}
                >
                  <Avatar
                    className={styles.avatar}
                    sx={{
                      background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                      width: 36,
                      height: 36,
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      border: '2px solid rgba(255,255,255,0.3)',
                    }}
                  >
                    {userInitial}
                  </Avatar>
                </IconButton>
              </Tooltip>
            )}

            {/* Desktop Dropdown Menu */}
            {!isMobile && (
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  className: styles.menuPaper,
                }}
              >
                <Box className={styles.menuHeader}>
                  <Avatar
                    sx={{
                      background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                      width: 40,
                      height: 40,
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  >
                    {userInitial}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#202124' }}>
                      {session?.user?.email}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#5f6368' }}>
                      Your Account
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <MenuItem onClick={handleLogout} className={styles.logoutMenuItem}>
                  <LogoutIcon className={styles.logoutIcon} />
                  <Typography variant="body2">Sign Out</Typography>
                </MenuItem>
              </Menu>
            )}

            {/* Mobile Hamburger Menu */}
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={handleDrawerToggle}
                className={styles.hamburgerIcon}
              >
                <MenuIcon sx={{ fontSize: '1.5rem' }} />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          anchor="right"
          open={mobileDrawerOpen}
          onClose={handleDrawerToggle}
          PaperProps={{
            className: styles.mobilePaper,
          }}
        >
          <Box className={styles.mobileDrawerContent}>
            <Box className={styles.mobileHeader}>
              <Box className={styles.mobileLogo}>
                <EmojiEventsIcon sx={{ fontSize: '1.5rem', color: '#ffc107' }} />
                <Typography sx={{ fontWeight: 700, color: '#202124', ml: 1 }}>
                  Cricket Predictions
                </Typography>
              </Box>
              <IconButton onClick={handleDrawerToggle} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            <List sx={{ flex: 1 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/dashboard')}
                  selected={isActive('/dashboard')}
                  className={styles.mobileNavItem}
                >
                  <ListItemIcon>
                    <HomeIcon sx={{ color: '#4285f4' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Dashboard"
                    primaryTypographyProps={{ sx: { fontWeight: 500 } }}
                  />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/leaderboard')}
                  selected={isActive('/leaderboard')}
                  className={styles.mobileNavItem}
                >
                  <ListItemIcon>
                    <EmojiEventsIcon sx={{ color: '#ffc107' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Leaderboard"
                    primaryTypographyProps={{ sx: { fontWeight: 500 } }}
                  />
                </ListItemButton>
              </ListItem>
            </List>

            <Divider />

            <Box className={styles.mobileUserSection}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Avatar
                  sx={{
                    background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                    width: 40,
                    height: 40,
                    fontWeight: 700,
                  }}
                >
                  {userInitial}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#202124' }}>
                    {session?.user?.email}
                  </Typography>
                </Box>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                className={styles.mobileLogoutButton}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        </Drawer>
      )}
    </>
  );
};

export default Navbar;
