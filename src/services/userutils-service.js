import { getUserName, mergeUrl, viewIssueUrl } from "../common/utils";
import moment from "moment";
import { DefaultWorkingDays } from "../constants/settings";

export default class UserUtilsService {
    static dependencies = ["SessionService", "UtilsService"];

    constructor($session, $utils) {
        this.$session = $session;
        this.$utils = $utils;
    }

    getTicketUrl = (ticketNo) => viewIssueUrl(this.$session.CurrentUser.jiraUrl, ticketNo);

    mapJiraUrl = (url) => mergeUrl(this.$session.CurrentUser.jiraUrl, url);

    isHoliday = (date) => {
        const weekDay = date.getDay();
        const workingDays = this.$session.CurrentUser.workingDays || DefaultWorkingDays;
        //ToDo: Need to have track of holiday and need to do the checking here
        return workingDays.indexOf(weekDay) === -1;
    };

    getProfileImgUrl = (user) => {
        if (user.jiraUser) {
            user = user.jiraUser;
        }
        if (user.avatarUrls) {
            return user.avatarUrls["48x48"] || user.avatarUrls["32x32"];
        }
        else {
            return `${this.$session.rootUrl}/secure/useravatar?ownerId=${getUserName(user, true)}`;
        }
        ///Security/ProfilePic / {{userInfo.name }}
    };

    getProfileUrl = (user, rootUrl) => {
        if (!user) {
            user = this.$session.CurrentUser;
        }

        if (typeof user === "object") {
            if (user.jiraUser) {
                user = user.jiraUser;
            }
        }
        else if (typeof user !== "string") {
            user = "";
        }

        if (this.$session.CurrentUser.isAtlasCloud) {
            return `${rootUrl || this.$session.rootUrl}/jira/people/${user?.accountId}`;
        } else {
            user = getUserName(user, true) || '';
            return `${rootUrl || this.$session.rootUrl}/secure/ViewUser.jspa?name=${user}`;
        }
    };

    formatDateTime = (value, format, utc) => {
        if (!value) { return value; }
        if (!format) { format = `${this.$session.CurrentUser.dateFormat} ${this.$session.CurrentUser.timeFormat}`; }
        let date = this.$utils.convertDate(value);
        if (date && date instanceof Date) {
            if (utc === true) {
                date = date.toUTCDate();
            }
            if (format?.toLowerCase() === "quick") {
                return moment(date).fromNow();
            } else if (format?.toLowerCase() === "num") {
                return moment(moment()).diff(date, 'days');
            } else {
                return date.format(format);
            }
        }
        return date;
    };

    formatDate = (value, format, utc) => {
        if (!format) {
            format = this.$session.CurrentUser.dateFormat;
        }
        return this.formatDateTime(value, format, utc);
    };

    formatTime = (value, format, utc) => this.formatDateTime(value, format || this.$session.CurrentUser.timeFormat, utc);

    getDays = (fromDate, toDate) => {
        const dateArr = this.$utils.getDateArray(fromDate, toDate);
        const now = new Date().getTime();
        return dateArr.map(d => ({
            prop: d.format('yyyyMMdd'),
            display: d.format('DDD, dd'),
            date: d,
            isHoliday: this.isHoliday(d),
            isFuture: d.getTime() > now
        }));
    };

    getWorklogUrl(ticketNo, worklogId) {
        let url = this.getTicketUrl(ticketNo);
        if (url && worklogId) {
            // ToDo: pending implementation
        }
        url += `?focusedWorklogId=${worklogId}&page=com.atlassian.jira.plugin.system.issuetabpanels%3Aworklog-tabpanel#worklog-${worklogId}`;
        return url;
    }
}