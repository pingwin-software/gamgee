/**
 * Gamgee's icons: Phosphor (duotone), behind the names the app already uses.
 *
 * Every icon in the app comes from here, never from an icon package directly,
 * so the set can be swapped in one place. Weights: duotone by default (a line
 * with a soft filled layer); line-only glyphs (check, x, arrows, plus/minus)
 * are bold, since duotone adds nothing to them; `fill` or a heavy
 * `strokeWidth` (>= 2.5, as the active bottom-bar mark uses) asks for the
 * solid "fill" weight, or bold for line glyphs.
 */
import type { ComponentType, CSSProperties, MouseEventHandler, AriaAttributes } from "react";
import {
  ArrowCounterClockwise as PArrowCounterClockwise, ArrowDown as PArrowDown, ArrowDownRight as PArrowDownRight, ArrowLeft as PArrowLeft, ArrowRight as PArrowRight, ArrowUpRight as PArrowUpRight, ArrowsClockwise as PArrowsClockwise, ArrowsLeftRight as PArrowsLeftRight, Barbell as PBarbell, Bell as PBell, BellRinging as PBellRinging, BellSlash as PBellSlash, Bicycle as PBicycle, BookOpen as PBookOpen, BookmarkSimple as PBookmarkSimple, Brain as PBrain, Broadcast as PBroadcast, Bug as PBug, Calendar as PCalendar, CalendarBlank as PCalendarBlank, CalendarCheck as PCalendarCheck, CalendarDots as PCalendarDots, CaretDoubleDown as PCaretDoubleDown, CaretDoubleUp as PCaretDoubleUp, CaretDown as PCaretDown, CaretLeft as PCaretLeft, CaretRight as PCaretRight, CaretUp as PCaretUp, ChatCenteredDots as PChatCenteredDots, ChatCenteredText as PChatCenteredText, ChatCircle as PChatCircle, ChatsCircle as PChatsCircle, Check as PCheck, Checks as PChecks, Circle as PCircle, ClipboardText as PClipboardText, Clock as PClock, ClockCounterClockwise as PClockCounterClockwise, Compass as PCompass, Copy as PCopy, Crosshair as PCrosshair, Crown as PCrown, Drop as PDrop, Egg as PEgg, Equals as PEquals, Eye as PEye, Fingerprint as PFingerprint, Fire as PFire, Flag as PFlag, FlipHorizontal as PFlipHorizontal, FloppyDisk as PFloppyDisk, Footprints as PFootprints, Gauge as PGauge, GraduationCap as PGraduationCap, Hand as PHand, HandFist as PHandFist, Heart as PHeart, Heartbeat as PHeartbeat, Info as PInfo, Key as PKey, Lightbulb as PLightbulb, Lightning as PLightning, List as PList, Lock as PLock, LockOpen as PLockOpen, MagicWand as PMagicWand, MagnifyingGlass as PMagnifyingGlass, MapPin as PMapPin, Medal as PMedal, MedalMilitary as PMedalMilitary, Minus as PMinus, Moon as PMoon, Mountains as PMountains, Palette as PPalette, PaperPlaneTilt as PPaperPlaneTilt, Pause as PPause, PencilLine as PPencilLine, PencilSimple as PPencilSimple, Percent as PPercent, Person as PPerson, Pill as PPill, Play as PPlay, Plus as PPlus, Prohibit as PProhibit, Pulse as PPulse, Ruler as PRuler, Scales as PScales, Shield as PShield, ShieldCheck as PShieldCheck, Shuffle as PShuffle, SignOut as PSignOut, SlidersHorizontal as PSlidersHorizontal, Sparkle as PSparkle, Square as PSquare, SquaresFour as PSquaresFour, Stack as PStack, Star as PStar, SunDim as PSunDim, SunHorizon as PSunHorizon, Sword as PSword, TShirt as PTShirt, Target as PTarget, Timer as PTimer, Trash as PTrash, TrendDown as PTrendDown, TrendUp as PTrendUp, Trophy as PTrophy, User as PUser, UserCircle as PUserCircle, UserPlus as PUserPlus, UsersThree as PUsersThree, WarningCircle as PWarningCircle, Wind as PWind, Wrench as PWrench, X as PX,
  type Icon as PhosphorIcon, type IconWeight,
} from "@phosphor-icons/react";

export interface IconProps extends AriaAttributes {
  size?: number | string;
  /** Kept from the old set: >= 2.5 asks for a heavier weight. */
  strokeWidth?: number;
  /** Any fill other than "none" asks for the solid weight. */
  fill?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
  role?: string;
  onClick?: MouseEventHandler<SVGSVGElement>;
  weight?: IconWeight;
}
export type IconType = ComponentType<IconProps>;

function make(P: PhosphorIcon, line: boolean, name: string): IconType {
  const C = ({ size = 24, strokeWidth, fill, weight, className, ...rest }: IconProps) => {
    const heavy = (fill && fill !== "none") || (strokeWidth ?? 0) >= 2.5;
    const w: IconWeight = weight ?? (line ? "bold" : heavy ? "fill" : "duotone");
    // "gi" lets simple.css strengthen the duotone layer (Phosphor draws it at 20 %).
    return <P size={size} weight={w} className={className ? `gi ${className}` : "gi"} {...rest} />;
  };
  C.displayName = name;
  return C;
}

export const Activity = make(PPulse, true, "Activity");
export const AlertCircle = make(PWarningCircle, false, "AlertCircle");
export const ArrowDown = make(PArrowDown, true, "ArrowDown");
export const ArrowDownRight = make(PArrowDownRight, true, "ArrowDownRight");
export const ArrowLeft = make(PArrowLeft, true, "ArrowLeft");
export const ArrowLeftRight = make(PArrowsLeftRight, true, "ArrowLeftRight");
export const ArrowRight = make(PArrowRight, true, "ArrowRight");
export const ArrowUpRight = make(PArrowUpRight, true, "ArrowUpRight");
export const Award = make(PMedalMilitary, false, "Award");
export const Ban = make(PProhibit, false, "Ban");
export const Beef = make(PEgg, false, "Beef");
export const Bell = make(PBell, false, "Bell");
export const BellOff = make(PBellSlash, false, "BellOff");
export const BellRing = make(PBellRinging, false, "BellRing");
export const BicepsFlexed = make(PHandFist, false, "BicepsFlexed");
export const Bike = make(PBicycle, false, "Bike");
export const BookOpen = make(PBookOpen, false, "BookOpen");
export const Bookmark = make(PBookmarkSimple, false, "Bookmark");
export const Brain = make(PBrain, false, "Brain");
export const Bug = make(PBug, false, "Bug");
export const Calendar = make(PCalendarBlank, false, "Calendar");
export const CalendarCheck = make(PCalendarCheck, false, "CalendarCheck");
export const CalendarClock = make(PCalendarDots, false, "CalendarClock");
export const CalendarDays = make(PCalendar, false, "CalendarDays");
export const Check = make(PCheck, true, "Check");
export const CheckCheck = make(PChecks, true, "CheckCheck");
export const ChevronDown = make(PCaretDown, true, "ChevronDown");
export const ChevronLeft = make(PCaretLeft, true, "ChevronLeft");
export const ChevronRight = make(PCaretRight, true, "ChevronRight");
export const ChevronUp = make(PCaretUp, true, "ChevronUp");
export const ChevronsDown = make(PCaretDoubleDown, true, "ChevronsDown");
export const ChevronsUp = make(PCaretDoubleUp, true, "ChevronsUp");
export const Circle = make(PCircle, false, "Circle");
export const ClipboardList = make(PClipboardText, false, "ClipboardList");
export const Clock = make(PClock, false, "Clock");
export const Compass = make(PCompass, false, "Compass");
export const Copy = make(PCopy, false, "Copy");
export const Crosshair = make(PCrosshair, true, "Crosshair");
export const Crown = make(PCrown, false, "Crown");
export const Droplets = make(PDrop, false, "Droplets");
export const Dumbbell = make(PBarbell, false, "Dumbbell");
export const Equal = make(PEquals, true, "Equal");
export const Eye = make(PEye, false, "Eye");
export const Fingerprint = make(PFingerprint, false, "Fingerprint");
export const Flag = make(PFlag, false, "Flag");
export const Flame = make(PFire, false, "Flame");
export const FlipHorizontal2 = make(PFlipHorizontal, false, "FlipHorizontal2");
export const Footprints = make(PFootprints, false, "Footprints");
export const Gauge = make(PGauge, false, "Gauge");
export const GraduationCap = make(PGraduationCap, false, "GraduationCap");
export const Hand = make(PHand, false, "Hand");
export const Heart = make(PHeart, false, "Heart");
export const HeartPulse = make(PHeartbeat, false, "HeartPulse");
export const History = make(PClockCounterClockwise, false, "History");
export const Info = make(PInfo, false, "Info");
export const KeyRound = make(PKey, false, "KeyRound");
export const Layers = make(PStack, false, "Layers");
export const LayoutGrid = make(PSquaresFour, false, "LayoutGrid");
export const Lightbulb = make(PLightbulb, false, "Lightbulb");
export const Lock = make(PLock, false, "Lock");
export const LogOut = make(PSignOut, false, "LogOut");
export const MapPin = make(PMapPin, false, "MapPin");
export const Medal = make(PMedal, false, "Medal");
export const Menu = make(PList, true, "Menu");
export const MessageCircle = make(PChatCircle, false, "MessageCircle");
export const MessageSquare = make(PChatCenteredText, false, "MessageSquare");
export const MessageSquarePlus = make(PChatCenteredDots, false, "MessageSquarePlus");
export const MessagesSquare = make(PChatsCircle, false, "MessagesSquare");
export const Minus = make(PMinus, true, "Minus");
export const Moon = make(PMoon, false, "Moon");
export const Mountain = make(PMountains, false, "Mountain");
export const Palette = make(PPalette, false, "Palette");
export const Pause = make(PPause, false, "Pause");
export const PenLine = make(PPencilLine, false, "PenLine");
export const Pencil = make(PPencilSimple, false, "Pencil");
export const Percent = make(PPercent, true, "Percent");
export const PersonStanding = make(PPerson, false, "PersonStanding");
export const Pill = make(PPill, false, "Pill");
export const Play = make(PPlay, false, "Play");
export const Plus = make(PPlus, true, "Plus");
export const Radio = make(PBroadcast, false, "Radio");
export const RefreshCw = make(PArrowsClockwise, true, "RefreshCw");
export const RotateCcw = make(PArrowCounterClockwise, true, "RotateCcw");
export const Ruler = make(PRuler, false, "Ruler");
export const Save = make(PFloppyDisk, false, "Save");
export const Scale = make(PScales, false, "Scale");
export const Search = make(PMagnifyingGlass, false, "Search");
export const Send = make(PPaperPlaneTilt, false, "Send");
export const Settings2 = make(PSlidersHorizontal, false, "Settings2");
export const Shield = make(PShield, false, "Shield");
export const ShieldCheck = make(PShieldCheck, false, "ShieldCheck");
export const Shirt = make(PTShirt, false, "Shirt");
export const Shuffle = make(PShuffle, true, "Shuffle");
export const Sparkles = make(PSparkle, false, "Sparkles");
export const Square = make(PSquare, false, "Square");
export const Star = make(PStar, false, "Star");
export const Sunrise = make(PSunHorizon, false, "Sunrise");
export const Sunset = make(PSunDim, false, "Sunset");
export const Swords = make(PSword, false, "Swords");
export const Target = make(PTarget, false, "Target");
export const Timer = make(PTimer, false, "Timer");
export const Trash2 = make(PTrash, false, "Trash2");
export const TrendingDown = make(PTrendDown, true, "TrendingDown");
export const TrendingUp = make(PTrendUp, true, "TrendingUp");
export const Trophy = make(PTrophy, false, "Trophy");
export const Unlock = make(PLockOpen, false, "Unlock");
export const User = make(PUser, false, "User");
export const UserPlus = make(PUserPlus, false, "UserPlus");
export const UserRound = make(PUserCircle, false, "UserRound");
export const Users = make(PUsersThree, false, "Users");
export const Wand2 = make(PMagicWand, false, "Wand2");
export const Weight = make(PBarbell, false, "Weight");
export const Wind = make(PWind, false, "Wind");
export const Wrench = make(PWrench, false, "Wrench");
export const X = make(PX, true, "X");
export const Zap = make(PLightning, false, "Zap");
