import CommentsDisplay from './CommentsDisplay';
import DateDisplay from './DateDisplay';
import IssueDisplay from './IssueDisplay';
import IssueLinkDisplay from './IssueLinkDisplay';
import ItemDisplay from './ItemDisplay';
import ProgressDisplay from './ProgressDisplay';
import ProjectDisplay from './ProjectDisplay';
import TagsDisplay from './TagsDisplay';
import TicketDisplay from './TicketDisplay';
import TimeSpentDisplay from './TimeSpentDisplay';
import TimeTrackDisplay from './TimeTrackDisplay';
import UnknownItemDisplay from './UnknownItemDisplay';
import UserDisplay from './UserDisplay';

export {
    CommentsDisplay, DateDisplay, IssueDisplay, IssueLinkDisplay,
    ItemDisplay, ProgressDisplay, ProjectDisplay, TagsDisplay, TicketDisplay,
    TimeSpentDisplay, TimeTrackDisplay, UnknownItemDisplay, UserDisplay
};

export function getComponentFor(type) {
    switch (type) {
        case 'ageindays': return { Component: DateDisplay, props: { quick: true } };
        case 'date': return { Component: DateDisplay, props: { dateOnly: true } };
        case 'datetime': return { Component: DateDisplay };
        case 'parent': return { Component: IssueDisplay, props: { settings: { valueType: 'both' } } };
        case 'progress': return { Component: ProgressDisplay };
        case 'project': return { Component: ProjectDisplay, props: { settings: { valueType: 'both' } } };
        case 'timespent': return { Component: TimeSpentDisplay };
        case 'timetracking': return { Component: TimeTrackDisplay };
        case 'comments-page': return { Component: CommentsDisplay };
        case 'user': return { Component: UserDisplay };
        case 'votes': return { Component: TagsDisplay, props: { tagProp: 'votes' } };
        case 'issuetype':
        case 'status':
        case 'resolution':
        case 'priority':
            return { Component: ItemDisplay };
        default: return { Component: UnknownItemDisplay };
    }
}