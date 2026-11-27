// Design-system components (spec 002), ported from design/system/components. Screens use only
// what this package exports, with theme token classes for layout.
export { theme, themeColors, defaultTheme, type ThemeId, type ColorName } from './theme';
export { ThemeProvider, useThemeColors } from './ThemeProvider';
export { cn } from './cn';
export { announce, pressedState, useLargeText, useReturnFocus, LARGE_TEXT_SCALE } from './a11y';
export { useReduceMotion } from './reduceMotion';
export {
  gutterFor,
  layoutTier,
  navFor,
  popoverPlacement,
  railInset,
  sheetPresentation,
  splitColumns,
  tabBottomPad,
  useLayoutTier,
  useSheetPresentation,
  type LayoutTier,
  type SheetKind,
  type SheetPresentation,
} from './layout';

export { DetailText, Text, type TextProps, type TextVariant, type TextColor, type Weight } from './components/Text';
export { BrandMark, Icon, Logo, type BrandName, type IconName, type IconProps } from './components/Icon';
export { AppFrame, TabScreen, PushedScreen, PhotoScreen, PublicScreen, FormScreen, SplitView, ColumnScreen, type PhotoScreenProps, type PublicScreenProps, type SplitViewProps } from './components/Layout';

export { Button, DisclosureButton, Link, type ButtonProps, type ButtonVariant, type ButtonSize, type DisclosureButtonProps, type LinkProps } from './components/Button';
export { IconButton, type IconButtonProps, type IconButtonVariant } from './components/IconButton';
export { AppGrid, AppTile, type AppTileProps } from './components/AppTile';
export { IconTile, type IconTileProps, type IconTileTone } from './components/IconTile';
export { Pill, FilterButton, Choice, PersonPill, PillRow, SuggestionPill, TogglePill, type SuggestionPillProps } from './components/Pill';
export { RowScroll } from './components/RowScroll';
export { Tag, Meta, type TagTone, type MetaTone } from './components/Tag';
export { Switch, SettingRow, type SwitchProps, type SettingRowProps } from './components/Switch';
export { SegmentedControl, SegmentedSettingRow, type SegmentedControlProps, type Segment } from './components/SegmentedControl';
export { Stepper, type StepperProps } from './components/Stepper';
export { FieldWarning, TextField, SearchField, PickerField, type TextFieldProps, type PickerFieldProps } from './components/TextField';
export { MonthPicker, type MonthPickerProps } from './components/MonthPicker';
export { AmountField, type AmountFieldProps } from './components/AmountField';
export { RadioCard, type RadioCardProps } from './components/RadioCard';
export { ResultTile, type ResultTileProps } from './components/ResultTile';
export { PhotoField, type PhotoFieldProps } from './components/PhotoField';
export { PhotoCrop, PHOTO_ASPECT, type CropRect, type PhotoCropProps } from './components/PhotoCrop';
export { IconRow, ListGroup, ListRow, ListRowSkeleton, Overline, IngredientRow, type IconRowProps, type ListRowProps } from './components/ListRow';
export { Card, HeroCard, HeroCarousel, Photo, PhotoPlaceholder, Thumb, type CardProps, type HeroAction, type HeroCardProps } from './components/Card';
export { CookSessionCard, type CookSessionCardProps } from './components/CookSessionCard';
export { GroceryRecipeCard, RecipeItem, RecipeItemSkeleton, RecipeSummary, type GroceryRecipeCardProps, type RecipeItemProps, type RecipeSummaryProps } from './components/RecipeItem';
export { LinkField, type LinkFieldProps } from './components/LinkField';
export { StatTile, type StatTileProps } from './components/StatTile';
export { ActivityRow, LatestActivityCard, type ActivityRowProps, type LatestActivityCardProps } from './components/ActivityRow';
export { Callout, type CalloutProps, type CalloutVariant } from './components/Callout';
export { Avatar, AvatarStack, type AvatarColor, type MemberColor } from './components/Avatar';
export { MemberBadge, MemberChip, MemberCount, MemberFilterChip, MemberPickerChip, MemberStack, type MemberBadgeProps, type MemberChipColor, type MemberChipProps, type MemberCountProps, type MemberPickerChipProps } from './components/MemberChip';
export { SlotChip, type SlotChipProps } from './components/SlotChip';
export { DayChip, type DayChipProps } from './components/DayChip';
export { NoteText, NotesSection, type NoteAlign, type NoteBlock, type NoteSpan, type NoteTextProps } from './components/NoteText';
export { NoteFormattingToolbar, type NoteFormattingToolbarProps, type NoteToolbarFormat } from './components/NoteFormattingToolbar';
export { MemberPill, ReminderMore, ReminderRow, type ReminderRowProps } from './components/ReminderRow';
export { WeekdayPicker, type WeekdayPickerProps } from './components/WeekdayPicker';
export { DateGrid, type DateGridDay, type DateGridProps } from './components/DateGrid';
export { EventBar, EventChip, Fill, MoreCount, TravelMark, isTravelLook, BAR_STEP, BAR_TOP, WEEK_BAR_STEP, WIDE_WEEK_BAR_STEP, type ChipSize, type EventBarProps, type EventChipProps, type EventColor } from './components/EventChip';
export { MonthGrid, MONTH_ROW_HEIGHT, type MonthBar, type MonthCell, type MonthCellItem, type MonthGridProps, type MonthWeek } from './components/MonthGrid';
export {
  HourGrid,
  GRID_FIRST_HOUR,
  GRID_HEIGHT,
  GRID_HOURS,
  HOUR_HEIGHT,
  WIDE_HOUR_HEIGHT,
  hourAt,
  type HourGridProps,
  type HourGridSize,
  type WeekAllDayBar,
  type WeekBlock,
  type WeekColumn,
  type WeekDayHead,
} from './components/HourGrid';
export { Swipeable, SWIPE_COMMIT, type SwipeableProps } from './components/Swipeable';
export { EventListGroup, EventListRow, ReminderListRow, WeekEventGroup, type EventListItem, type ReminderListItem, type ReminderListRowProps, type WeekEventDay, type WeekEventItem } from './components/EventListRow';
export { CalCard, CalCardBanner, WeekStrip, type CalCardProps, type WeekStripDay } from './components/CalCard';
export { AllDayRow, DayEventRow, DayReminderRow, SlotBand, type DayAllDayItem, type DayBand, type DayBandItem, type DayReminderItem, type DayEventItem, type SlotBandProps } from './components/SlotBand';
export { FloatingAdd, Toast, ToastHost, ToastProvider, useToast, TOAST_MS, TOAST_ACTION_MS, type FloatingAddProps, type ToastProps, type ToastProviderProps, type ToastRequest } from './components/Toast';
export { CalendarHeader, type CalendarHeaderChip, type CalendarHeaderProps } from './components/CalendarHeader';
export { ComingUpRow, MiniMonth, type ComingUpRowProps, type MiniMonthDay, type MiniMonthProps } from './components/MiniMonth';
export { ColorSwatch, type ColorSwatchProps, type SwatchOption } from './components/ColorSwatch';
export { StatusBanner, Presence, AwakeChip, SuccessPanel } from './components/StatusBanner';
export { StepCard, StepFootnote, StepRow, StepText, TimerRow, type StepTextPart, type TimerState } from './components/StepCard';
export { CookTimerCard, TimerCard, type TimersScreenState } from './components/TimerCard';
export { TimerPill, type TimerPillProps } from './components/TimerPill';
export { TimePresets, type TimePreset, type TimePresetsProps } from './components/TimePresets';
export { TimeRange, type TimeRangeField, type TimeRangeProps } from './components/TimeRange';
export { TimeField, type TimeFieldProps } from './components/TimeField';
export { TabBar, TAB_LABEL_MIN_SCALE, type TabBarItem, type TabBarProps } from './components/TabBar';
export { NavRail, type NavRailProps } from './components/NavRail';
export { BottomSheet, SheetFooter, type BottomSheetProps } from './components/BottomSheet';
export { Dialog, type DialogProps } from './components/Dialog';
export { FormProgress, CookProgress, StepBar } from './components/Progress';
export { CookLayout, CookSection, cookColumns, cookStepHeight, type CookLayoutProps, type CookSectionProps } from './components/CookLayout';
export { CookStepList, type CookStepListItem, type CookStepListProps } from './components/CookStepList';
export { PhotoViewer, StepPhoto, type PhotoViewerProps, type StepPhotoProps } from './components/PhotoViewer';
export { TabHeader, BrandRow, BrandHeader, Lead, FormBar } from './components/ScreenHeader';
export { TopBar, TopBarHeading, type TopBarConfig, type TopBarProps } from './components/TopBar';
export { ActionMenu, type ActionMenuItem, type ActionMenuProps } from './components/ActionMenu';
export { IngredientEditCard, type IngredientEditCardProps, type IngredientEditField } from './components/IngredientEditCard';
export { ReorderList, dropIndex, type ReorderListProps } from './components/ReorderList';
export { FieldPair, StepEditCard, StepNote, StepPreview, type StepEditCardProps } from './components/StepEditCard';
export { TokenEditor, type TokenEditorProps, type TokenPart } from './components/TokenEditor';
export { ShareTile, type ShareTileProps } from './components/ShareTile';
export { ToggleTile, type ToggleTileProps } from './components/ToggleTile';
