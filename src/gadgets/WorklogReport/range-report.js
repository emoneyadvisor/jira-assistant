import moment from "moment";
import { getUserName } from "../../common/utils";
import { inject } from "../../services/injector-service";
import { filterDaysWithoutWorklog, generateUserDayWiseData, getEpicDetails, getUserWiseWorklog, getWeekHeader } from "./userdaywise/utils_group";
import { generateFlatWorklogData, getFieldsToFetch } from "./utils";

/* eslint-disable no-unused-vars */
export function generateRangeReport(setState, getState) {
    return async function () {
        const newState = { loadingData: false };
        try {
            setState({ loadingData: true });

            const { dateRange: { fromDate, toDate } } = getState();
            if (!fromDate || !toDate) {
                return null;
            }

            const result = await generateWorklogReportForDateRange(moment(fromDate).startOf('day'),
                moment(toDate).endOf('day'), getState());

            if (!result) {
                const { $message } = inject('MessageService');
                $message.warning('No worklog information returned matching your filters', 'No data available');
                return;
            }

            const { groupReport, flatWorklogs } = result;
            newState.groupReport = groupReport;
            newState.flatWorklogs = flatWorklogs;

            newState.reportLoaded = true;
        } catch (err) {
            console.error('Error pulling range report', err);
            const { $message } = inject('MessageService');
            $message.error(`Error Details:- ${err.message}`, 'Unknown error');
        } finally {
            setState(newState);
        }
    };
}

async function generateWorklogReportForDateRange(fromDate, toDate, state) {
    const { $session: { CurrentUser: { name, epicNameField } } } = inject('SessionService');
    const issues = await getIssuesWithWorklogFor(fromDate, toDate, state, epicNameField?.id);
    if (!issues.length) {
        return;
    }

    const epicDetails = await getEpicDetails(issues, epicNameField?.id);

    const { userListMode, userGroups: savedGroups, reportUserGrp } = state;
    const useGroups = userListMode !== '1';
    if (!useGroups && reportUserGrp !== '1') {
        const { groupByFunc, getGroupName } = getGroupingFunction(reportUserGrp, epicNameField?.id);

        const flatWorklogs = [];
        const groupReport = issues.groupBy(groupByFunc)
            .map(({ values }) => ({ issues: values, grpName: getGroupName(values) })) // Create object with group names
            .sortBy(({ grpName }) => grpName) // Sort with group names
            .reduce((obj, { grpName, issues }) => {
                const {
                    flatWorklogs: flatData,
                    groupReport: { dates, groupedData: g }
                } = formGroupedWorklogs(issues, fromDate, toDate, name?.toLowerCase(), state, useGroups && savedGroups, epicDetails, obj.dates, grpName);

                obj.dates = dates;

                // If custom group does not have any worklog, don't include it in report
                if (!g.grandTotal) {
                    return obj;
                }

                flatWorklogs.addRange(flatData);

                // Add the item in the grouplist to our array of groups
                const [grp] = g;
                grp.name = grpName;
                delete grp.isDummy;
                const { groupedData } = obj;
                groupedData.push(grp);

                // Sumup other extended properties in array
                groupedData.grandTotal = (groupedData.grandTotal || 0) + (g.grandTotal || 0);
                groupedData.grandTotalCost = (groupedData.grandTotalCost || 0) + (g.grandTotalCost || 0);
                groupedData.total = sumAndMergeObjectProps(groupedData.total, g.total);
                groupedData.totalCost = sumAndMergeObjectProps(groupedData.totalCost, g.totalCost);

                return obj;
            }, { groupedData: [] });

        // As multiple groups are executed seperately, filtering logic is added here
        groupReport.dates = filterDaysWithoutWorklog(state.daysToHide, groupReport.dates);
        groupReport.weeks = getWeekHeader(groupReport.dates);

        return { flatWorklogs, groupReport };
    } else {
        return formGroupedWorklogs(issues, fromDate, toDate, name?.toLowerCase(), state, useGroups && savedGroups, epicDetails);
    }
}

function getGroupingFunction(reportUserGrp, epicNameField) {
    if (reportUserGrp === '3') { // group by issuetype
        return {
            getGroupName: (issues) => {
                const { name } = issues[0].fields.issuetype;
                return name;
            },
            groupByFunc: issue => issue.fields.issuetype.id
        };
    } else if (reportUserGrp === '4' && epicNameField) { // group by epic
        return {
            getGroupName: (issues) => {
                const epic = issues[0].fields[epicNameField];
                return epic || '<No epic assigned>';
            },
            groupByFunc: issue => issue.fields[epicNameField]
        };
    } else { // group by project
        return {
            getGroupName: (issues) => {
                const { name, key } = issues[0].fields.project;
                return `${name} (${key})`;
            },
            groupByFunc: issue => issue.fields.project.key
        };
    }
}

function sumAndMergeObjectProps(obj1, obj2) {
    if (!obj1) {
        return obj2;
    } else if (!obj2) {
        return obj1;
    } else {
        const newObj = { ...obj1 };
        Object.keys(obj2).forEach(k => {
            newObj[k] = (newObj[k] || 0) + (obj2[k] || 0);
        });
        return newObj;
    }
}

function formGroupedWorklogs(issues, fromDate, toDate, name, state, userGroups, epicDetails, dates, grpName) {
    const { userwiseLog, userwiseLogArr } = getUserWiseWorklog(issues, fromDate, toDate, name, state, epicDetails);
    if (!userGroups) {
        userGroups = [createGroupObjectWithUsers(userwiseLogArr, grpName)];
    }

    const settings = {
        fromDate: fromDate.toDate(),
        toDate: toDate.toDate(),
        timeZone: state.timeZone,
        dates,
        daysToHide: !dates ? state.daysToHide : null
    };

    const groupReport = generateUserDayWiseData(userwiseLog, userGroups, settings, state);
    const flatWorklogs = generateFlatWorklogData(userwiseLog, userGroups);

    return { groupReport, flatWorklogs };
}

// Set as empty as it would look odd in chart headers
const noGroupName = '';
function createGroupObjectWithUsers(users, name) {
    const result = users.reduce((obj, u) => {
        obj.totalHours += (u.totalHours || 0);
        obj.totalCost += (u.totalCost || 0);
        return obj;
    }, { totalHours: 0, totalCost: 0 });

    return { isDummy: true, name: name || noGroupName, users, ...result };
}

function getUniqueUsersFromGroup(state) {
    const { userGroups, userListMode } = state;
    if (userListMode === '1') { return null; }

    const userList = userGroups.union(grps => {
        grps.users.forEach(gu => gu.groupName = grps.name);
        return grps.users;
    });

    return userList.map(u => getUserName(u, true)).distinct();
}

async function getIssuesWithWorklogFor(fromDate, toDate, state, epicNameField) {
    const svc = inject('JiraService');

    const { fieldsToFetch, additionalJQL } = getFieldsToFetch(state, epicNameField);

    const userList = getUniqueUsersFromGroup(state);
    const author = userList ? `worklogAuthor in ("${userList.join('","')}") and ` : '';
    const jql = `${author}worklogDate >= '${fromDate.clone().add(-1, 'days').format("YYYY-MM-DD")}' and worklogDate < '${toDate.clone().add(1, 'days').format("YYYY-MM-DD")}'${additionalJQL}`;

    return await svc.$jira.searchTickets(jql, fieldsToFetch, 0, { worklogStartDate: fromDate.toDate(), worklogEndDate: toDate.toDate() });
}