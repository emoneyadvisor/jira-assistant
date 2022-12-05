import moment from 'moment';
import { getUserName } from '../../common/utils';
import { inject } from "../../services/injector-service";
import { generateUserDayWiseData, getUserWiseWorklog } from './userdaywise/utils_group';
import { generateFlatWorklogData, getFieldsToFetch } from './utils';

export function generateSprintReport(setState, getState) {
    return async function () {
        const curState = getState();
        const { selSprints: sel } = curState;

        const selBoards = Object.keys(sel).filter(bid => sel[bid]?.selected);
        if (!selBoards.length) { return; }

        const { $jira, $session: { CurrentUser: { name } } } = inject('JiraService', 'SessionService');

        const newState = { loadingData: false };

        try {
            setState({ loadingData: true, reportLoaded: false });

            const allSprints = await $jira.getRapidSprintList(selBoards, true);

            for (const boardId of selBoards) {
                const sprintsList = getSprintsSelected(boardId, sel, allSprints);

                newState[`sprintsList_${boardId}`] = sprintsList;

                const totalUsersList = [];
                const usersIndex = {};
                const flatWorklogs_board = [];
                newState[`flatWorklogs_${boardId}`] = flatWorklogs_board;

                for (const sprint of sprintsList) {
                    const { id, startDate, endDate, completeDate = endDate } = sprint;
                    const fromDate = moment(startDate), toDate = moment(completeDate);

                    const issuesList = await pullIssuesFromSprint(id, curState);
                    if (!issuesList.length) {
                        newState[`groupReport_${id}`] = null;
                        continue;
                    }
                    const { userwiseLog, userwiseLogArr } = getUserWiseWorklog(issuesList, fromDate, toDate, name?.toLowerCase(), curState);

                    const settings = {
                        fromDate: fromDate.toDate(),
                        toDate: toDate.toDate()
                    };

                    const { groupReport, flatWorklogs } = generateSprintGroupReport(sprint, userwiseLog, settings, curState);
                    flatWorklogs_board.addRange(flatWorklogs);

                    //newState[`rawData_${id}`] = issuesList;
                    //newState[`userwiseLog_${id}`] = userwiseLog;
                    //newState[`userwiseLogArr_${id}`] = userwiseLogArr;
                    newState[`groupReport_${id}`] = groupReport;
                    //newState[`sprint_${id}`] = sprint;

                    userwiseLogArr.forEach(u => {
                        const name = getUserName(u, true);
                        if (!usersIndex[name]) {
                            totalUsersList.push(u);
                            usersIndex[name] = true;
                        }
                    });
                }

                newState[`userGroup_${boardId}`] = formUserGroupToDisplay(sprintsList, newState, totalUsersList, curState);
            }

            newState.reportLoaded = true;
        } catch (err) {
            return Promise.reject(err);
        } finally {
            setState(newState);
        }
    };
}

function getCollectiveSprints(sprintsList, newState) {
    return sprintsList.map(s => {
        const { id, name } = s;

        const { dates } = newState[`groupReport_${id}`];

        return { id, name, days: dates.length };
    });
}

function formUserGroupToDisplay(sprintsList, newState, totalUsersList, { userListMode, userGroups }) {
    const sprints = getCollectiveSprints(sprintsList, newState);

    function mapGroup(name, totalUsers) {
        const { grandTotalHours, grandTotalCost, users, usersMap } =
            getCollectiveUsers(totalUsers, sprints, newState);

        return { name, users, usersMap, grandTotalHours, grandTotalCost, sprints };
    }

    if (userListMode === '2') {
        return userGroups.map(grp => mapGroup(grp.name, grp.users));
    } else {
        return [mapGroup('Sprint', totalUsersList)];
    }
}

function getCollectiveUsers(totalUsersList, sprints, newState) {
    let grandTotalHours = 0, grandTotalCost = 0;
    const users = totalUsersList.sortBy(u => u.displayName).map(u => {
        const allTickets = [], ticketsMap = {};
        const user = {
            ...u, tickets: allTickets,
            allSprintTotalCost: 0, allSprintTotalHours: 0
        };
        const name = getUserName(user);

        for (const sprint of sprints) {
            const { groupedData: [sprintData] } = newState[`groupReport_${sprint.id}`];
            const { tickets, grandTotal, grandTotalCost } = sprintData.usersMap[name] || { tickets: [] };

            if (grandTotal) {
                user.allSprintTotalHours += grandTotal;
            }
            if (grandTotalCost) {
                user.allSprintTotalCost += grandTotalCost;
            }

            for (const ticket of tickets) {
                const { ticketNo } = ticket;
                const exstTicket = ticketsMap[ticketNo];

                if (exstTicket) {

                    if (ticket.totalHours) {
                        exstTicket.grandTotalHours += ticket.totalHours;
                    }

                    if (ticket.totalCost) {
                        exstTicket.grandtotalCost += ticket.totalCost;
                    }
                    continue;
                }

                allTickets.push(ticket);
                ticketsMap[ticketNo] = ticket;
                ticket.allSprintTotalHours = ticket.totalHours;
                ticket.allSprintTotalCost = ticket.totalCost;
            }
        }

        grandTotalHours += user.allSprintTotalHours;
        grandTotalCost += user.allSprintTotalCost;

        return user;
    });

    return { grandTotalHours, grandTotalCost, users };
}

function getSprintsSelected(boardId, boards, allSprints) {
    const { range, custom } = boards[boardId];
    const sprintList = allSprints[boardId]?.sortBy(({ startDate }) => new Date(startDate).getTime(), true);

    switch (range) {
        case -1: return sprintList.filter(s => custom[s.id]).reverse();
        case 0: return [sprintList[0]].filter(Boolean);
        case 1:
            const lastSprint = sprintList[0];
            return [lastSprint.completeDate ? lastSprint : sprintList[1]].filter(Boolean);
        default:
            return sprintList.slice(0, range).reverse();
    }
}

async function pullIssuesFromSprint(sprintId, state) {
    const { $jira } = inject('JiraService');
    const { fieldsToFetch } = getFieldsToFetch();
    const request = { maxResults: 1000, fields: fieldsToFetch };
    if (state.jql?.trim()) {
        request.jql = state.jql?.trim();
    }
    const issues = await $jira.getSprintIssues(sprintId, request);

    return issues;
}

function generateSprintGroupReport(sprint, data, settings, { userListMode, userGroups }) {
    const groups = userListMode === '2' ? userGroups : generateGroupForSprint(sprint, data, settings);

    const groupReport = generateUserDayWiseData(data, groups, settings);
    const flatWorklogs = generateFlatWorklogData(data, groups, sprint.name);

    return { groupReport, flatWorklogs };
}

function generateGroupForSprint(sprint, data) {
    return [
        {
            name: sprint.name,
            users: Object.keys(data).map(k => data[k])
        }
    ];
}