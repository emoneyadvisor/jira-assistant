import { isPluginBuild } from "./constants/build-info";

const config = {
    modules: { // Controls if a specific module should be included in build or not
        dashboards: true,

        // Activities
        calendar: true,
        importWorklog: false,
        importIssues: false,
        planningPoker: false,

        // Reports
        worklogReport: true,
        worklogReportOld: false,
        pivotReport: false,
        sayDoRatioReport: true,
        sprintReport: false,
        customReport: false,
        estimateVsActual: false,
        reportBuilder: false,

        // Settings
        userGroups: true,
        generalSettings: true,
        advancedSettings: true,

        // Others
        contactUs: false,
        contribute: false
    },
    features: {
        header: {
            shareWithOthers: false,
            themes: true,
            youtubeHelp: false,
            devUpdates: false,
            jiraUpdates: true
        },
        dashboard: {
            manageBoard: true,
            manageGadgets: true
        },
        integrations: {
            googleCalendar: false,
            outlookCalendar: !isPluginBuild
        },
        common: {
            analytics: false,
            allowWebVersion: false
        }
    },
    settings: {
        defaultIntegratUrl: 'https://emoneyadvisor.atlassian.net'
    }
};

export default config;