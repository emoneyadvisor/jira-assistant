import {
    CommentsDisplay, DateDisplay, IssueDisplay, IssueLinkDisplay,
    ItemDisplay, ProgressDisplay, ProjectDisplay, TagsDisplay,
    TicketDisplay, TimeSpentDisplay, TimeTrackDisplay,
    UnknownItemDisplay, UserDisplay
} from "../../../display-controls";
import { resolve } from "../../../services/injector-service";

export async function loadReportData(query) {
    if (!query) { return {}; }

    const $jira = resolve('JiraService');
    const dataFields = query.fields.map((f) => f.field);
    const data = await $jira.searchTickets(query.jql, dataFields);
    const ref = {};
    const reportData = data.map(processIssue.bind(ref));
    const columnList = query.fields.map(processDisplayField.bind(ref));

    if (ref.hasWorklogs) {
        const usrObj = ref.usersObj;
        const userFields = Object.keys(usrObj).map(u => {
            const usr = usrObj[u];

            return {
                field: u, displayText: usr.displayName, type: 'seconds',
                groupText: 'Log Work', allowGrouping: false,
                viewComponent: TimeSpentDisplay,
                props: {}
            };
        });

        userFields.push({
            field: 'totalWorklog', displayText: 'Total Log Work', type: 'seconds',
            groupText: 'Log Work', allowGrouping: false,
            viewComponent: TimeSpentDisplay,
            props: {}
        });

        const wlIndex = columnList.findIndex(({ field }) => field === 'worklog');

        columnList.splice(wlIndex, 1, ...userFields);
    }

    const newState = { isLoading: false, reportData, columnList };

    return newState;
}

function processDisplayField(curCol) {
    const { id, field, name, type, isArray } = curCol;
    const props = {};

    const col = {
        id, field, displayText: name,
        type, props,
        allowSorting: !isArray,
        allowGrouping: field !== 'summary' && field !== 'description'
    };

    col.viewComponent = getViewComponent(field === 'issuekey' ? 'issuekey' : type, col, isArray);

    if (!col.allowSorting) {
        col.allowGrouping = false;
    }

    if (col.allowGrouping) {
        setGroupOptions(col);
    }

    return col;
}

function setGroupOptions(curCol) {
    const options = [
        { type: 'check', label: 'Show count', prop: 'showGroupCount', value: true },
        { separator: true }
        //{ type: 'check', label: 'Show unique count', prop: 'showUniqueCount', value: true }
    ];

    switch (curCol.type) {
        default: return;
        case 'user':
            options[1] = { type: 'check', label: 'Show Image', prop: 'showImage' };
            options.push({ separator: true });
            options.push({ type: 'radio', label: 'Show name', prop: 'valueType', value: 'name', default: true });
            options.push({ type: 'radio', label: 'Show email id', prop: 'valueType', value: 'email' });
            options.push({ type: 'radio', label: 'Show both', prop: 'valueType', value: 'both' });
            break;
        case 'project':
            options.push({ type: 'radio', label: 'Show name', prop: 'valueType', value: 'name' });
            options.push({ type: 'radio', label: 'Show key', prop: 'valueType', value: 'key', default: true });
            options.push({ type: 'radio', label: 'Show both', prop: 'valueType', value: 'both' });
            break;
        case 'parent':
            options[1] = { type: 'check', label: 'Show status', prop: 'showStatus', default: true };
            options.push({ separator: true });
            options.push({ type: 'radio', label: 'Show key', prop: 'valueType', value: 'key', default: true });
            options.push({ type: 'radio', label: 'Show summary', prop: 'valueType', value: 'summary' });
            options.push({ type: 'radio', label: 'Show both', prop: 'valueType', value: 'both' });
            break;
        case 'date':
        case 'datetime':
            options.push({ type: 'radio', label: 'Friendly date', prop: 'funcType', value: 'friendly' });
            options.push({ type: 'radio', label: 'Group by year', prop: 'funcType', value: 'yyyy' });
            options.push({ type: 'radio', label: 'Group by month', prop: 'funcType', value: 'MMMM' });
            options.push({ type: 'radio', label: 'Group by both', prop: 'funcType', value: 'yyyy-MM (MMMM)', default: true }); // Default format set inside groupableGrid as well
            options.push({ type: 'radio', label: 'Group by date', prop: 'funcType', value: 'yyyy-MM-dd' });
            break;
        case 'number':
        case 'seconds':
            options.push({ type: 'radio', label: 'Group by field', prop: 'funcType', value: '', default: true });
            options.push({ type: 'radio', label: 'Sum of field', prop: 'funcType', value: 'sum' });
            options.push({ type: 'radio', label: 'Avg of field', prop: 'funcType', value: 'avg' });
            options.push({ type: 'radio', label: 'Count having value', prop: 'funcType', value: 'count' });
            break;
    }

    curCol.groupOptions = options;
}

function processIssue(issue) {
    const fields = issue.fields;
    fields.issuekey = issue.key;
    fields.id = issue.id;

    processWorklogs.call(this, fields);
    processComments(fields);

    return fields;
}

function processComments(fields) {
    if (!fields.comment) { return; }

    fields.comment = fields.comment.comments;
}

function processWorklogs(fields) {
    if (!fields.worklog) { return; }

    fields.worklog = fields.worklog.worklogs;

    if (!fields.worklog.length) {
        delete fields.worklog;
        return;
    }

    this.hasWorklogs = true;

    const users = this.usersObj || {};
    this.usersObj = users;

    for (const worklog of fields.worklog) {
        const { author, timeSpentSeconds } = worklog;

        const { accountId, emailAddress } = author;
        const uid = emailAddress || accountId;

        if (!users[uid]) {
            users[uid] = author;
        }

        fields[uid] = (fields[uid] || 0) + timeSpentSeconds;
        fields['totalWorklog'] = (fields['totalWorklog'] || 0) + timeSpentSeconds;
    }
}

// eslint-disable-next-line complexity
function getViewComponent(fieldType, col, isArray) {
    const { props } = col;

    switch (fieldType) {
        case 'issuekey': return TicketDisplay;
        case 'epicLink':
            props.hideContext = true;
            return TicketDisplay;
        case 'project':
            col.fieldKey = `${col.field}.name`;
            return ProjectDisplay;
        case 'user':
            col.fieldKey = `${col.field}.displayName`;
            return UserDisplay;
        case 'comment':
            col.allowSorting = false;
            return CommentsDisplay;
        case 'issuelinks': return IssueLinkDisplay;
        case 'seconds': return TimeSpentDisplay;
        case 'timetracking': return TimeTrackDisplay;
        case 'parent':
            col.fieldKey = `${col.field}.key`;
            return IssueDisplay;
        case 'progress':
        case 'aggregateprogress':
            col.fieldKey = `${col.field}.percent`;
            return ProgressDisplay;
        case 'sprint': return TagsDisplay;
        case 'attachment':
            props.hrefProp = 'content';
            props.iconClass = 'fa-paperclip';
            props.tagProp = 'filename';
            return TagsDisplay;
        case 'component':
            props.titleProp = 'description';
            return TagsDisplay;
        case 'version':
            props.titleProp = 'releaseDate';
            return TagsDisplay;
        case 'votes':
            col.fieldKey = `${col.field}.votes`;
            props.tagProp = 'votes';
            return TagsDisplay;
        case 'watches':
            col.fieldKey = `${col.field}.watchCount`;
            props.tagProp = 'watchCount';
            return TagsDisplay;
        case 'date':
        case 'datetime':
            return DateDisplay;
        case 'issuetype':
        case 'status':
        case 'priority':
        case 'resolution':
            col.fieldKey = `${col.field}.name`;
            return ItemDisplay;
        case 'epicStatus':
            props.textField = 'value';
            props.iconField = '';
            col.fieldKey = `${col.field}.value`;
            return ItemDisplay;
        case 'string':
            if (!isArray) { return null; }

            props.tagProp = '';

            return TagsDisplay;
        case 'number': return UnknownItemDisplay;
        default:
            col.allowSorting = false;
            col.allowGrouping = false;
            return UnknownItemDisplay;
    }
}