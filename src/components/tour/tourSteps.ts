import type { ParseKeys } from 'i18next';
import { useAppStore } from '@/state/appStore';
import { FEEDBACK_AVAILABLE } from '@/utils/buildFlags';

export interface TourStep {
  anchor: string;
  titleKey: ParseKeys<'common'>;
  bodyKey: ParseKeys<'common'>;
  prepare: () => void;
}

const ALL_TOUR_STEPS: TourStep[] = [
  {
    anchor: 'ribbon-tabs',
    titleKey: 'tour.step1Title',
    bodyKey: 'tour.step1Body',
    prepare: () => { },
  },
  {
    anchor: 'gantt-panel',
    titleKey: 'tour.step2Title',
    bodyKey: 'tour.step2Body',
    prepare: () => { useAppStore.getState().setUI({ activeRibbonTab: 'start' }); },
  },
  {
    anchor: 'properties-panel',
    titleKey: 'tour.step3Title',
    bodyKey: 'tour.step3Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'start', showPropertiesPanel: true, rightPanelCollapsed: false });
    },
  },
  {
    anchor: 'histogram-strip',
    titleKey: 'tour.step4Title',
    bodyKey: 'tour.step4Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'start', showHistogram: true });
    },
  },
  {
    anchor: 'report-panel',
    titleKey: 'tour.step5Title',
    bodyKey: 'tour.step5Body',
    prepare: () => { useAppStore.getState().setUI({ activeRibbonTab: 'report' }); },
  },
  {
    anchor: 'backstage-examples',
    titleKey: 'tour.step6Title',
    bodyKey: 'tour.step6Body',
    prepare: () => {
      useAppStore.getState().setUI({ activeRibbonTab: 'file', backstageSection: 'examples' });
    },
  },
  {
    anchor: 'feedback-button',
    titleKey: 'tour.step7Title',
    bodyKey: 'tour.step7Body',
    prepare: () => { },
  },
];

export const TOUR_STEPS: TourStep[] = FEEDBACK_AVAILABLE
  ? ALL_TOUR_STEPS
  : ALL_TOUR_STEPS.filter(step => step.anchor !== 'feedback-button');
