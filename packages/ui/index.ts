// Design-system components (spec 002), ported from design/system/components. Screens use only
// what this package exports, with theme token classes for layout.
export { theme, themeColors, defaultTheme, type ThemeId, type ColorName } from './theme';
export { ThemeProvider, useThemeColors } from './ThemeProvider';
export { cn } from './cn';

export { Text, type TextProps, type TextVariant, type TextColor, type Weight } from './components/Text';
export { Icon, Logo, type IconName, type IconProps } from './components/Icon';
export { AppFrame, TabScreen, PushedScreen } from './components/Layout';

export { Button, Link, type ButtonProps, type ButtonVariant, type ButtonSize, type LinkProps } from './components/Button';
export { IconButton, type IconButtonProps, type IconButtonVariant } from './components/IconButton';
export { Pill, FilterButton, Choice, PersonPill, PillRow } from './components/Pill';
export { Tag, Meta, type TagTone, type MetaTone } from './components/Tag';
export { Switch, SettingRow, type SwitchProps, type SettingRowProps } from './components/Switch';
export { SegmentedControl, type SegmentedControlProps, type Segment } from './components/SegmentedControl';
export { Stepper, type StepperProps } from './components/Stepper';
export { TextField, SearchField, type TextFieldProps } from './components/TextField';
export { MonthPicker, type MonthPickerProps } from './components/MonthPicker';
export { ListGroup, ListRow, Overline, IngredientRow, type ListRowProps } from './components/ListRow';
export { Card, HeroCard, PhotoPlaceholder, type CardProps } from './components/Card';
export { RecipeItem, type RecipeItemProps } from './components/RecipeItem';
export { StatTile, type StatTileProps } from './components/StatTile';
export { Callout, type CalloutProps, type CalloutVariant } from './components/Callout';
export { Avatar, AvatarStack, avatarTone, type AvatarTone } from './components/Avatar';
export { StatusBanner, Presence, AwakeChip, SuccessPanel } from './components/StatusBanner';
export { StepCard, StepFootnote, StepText, TimerRow, type StepTextPart, type TimerState } from './components/StepCard';
export { CookTimerCard, TimerCard, type TimersScreenState } from './components/TimerCard';
export { TimerPill, type TimerPillProps } from './components/TimerPill';
export { TabBar, TAB_LABEL_MIN_SCALE, type TabBarItem, type TabBarProps } from './components/TabBar';
export { BottomSheet, SheetFooter, type BottomSheetProps } from './components/BottomSheet';
export { Dialog, type DialogProps } from './components/Dialog';
export { FormProgress, CookProgress } from './components/Progress';
export { TabHeader, BrandHeader, BackHeader, FormBar } from './components/ScreenHeader';
