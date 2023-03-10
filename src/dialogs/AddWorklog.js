import React from 'react';
import moment from 'moment';
import { InputMask } from 'primereact/inputmask';
import BaseDialog from './BaseDialog';
import { inject } from '../services/injector-service';
import { Button, Checkbox, DatePicker, TextBox } from '../controls';
import { GadgetActionType } from '../gadgets';
import { EventCategory } from '../constants/settings';
import { IssuePicker } from '../jira-controls/IssuePicker';

function convertHours(value) {
    if (!value) { return '01:00'; }

    value = value.toString().split('.');
    const h = parseInt(value[0]);
    const m = parseInt(Math.round(60 * `.${(value[1] || 0)}`)) || 0;
    return `${h.pad(2)}:${m.pad(2)}`;
}

class AddWorklog extends BaseDialog {
    constructor(props) {
        const { editTracker } = props;
        super(props, editTracker ? "Edit Tracker" : "Add worklog");
        this.style = { width: '90vw', maxWidth: '850px' };
        inject(this, "SessionService", "WorklogService", "WorklogTimerService", "MessageService", "UtilsService", "AnalyticsService");
        this.className = "add-worklog-popup";

        this.displayDateFormat = "yyyy-MM-dd HH:mm";
        const { commentLength, autoUpload, defaultTimeSpent } = this.$session.CurrentUser;
        this.minCommentLength = commentLength || 0;
        this.defaultTimeSpent = convertHours(defaultTimeSpent);

        const { worklog, uploadImmediately } = props;
        this.state = this.getState(worklog);
        this.state.uploadImmediately = typeof uploadImmediately === "boolean" ? uploadImmediately : (autoUpload || false);
        this.init(editTracker);
    }

    init(editTracker) {
        if (editTracker) {
            this.$wltimer.getCurrentTimer().then(entry => this.setState(this.getTrackerState(entry)));
        } else {
            this.loadWorklog(this.state.log);
        }
    }

    loadWorklog(log) {
        if (log.id) {
            this.fillWorklog(log, log.copy);
        }
    }

    getTrackerState(entry) {
        const log = {
            ticketNo: entry.key,
            dateStarted: new Date(entry.created),
            description: entry.description
        };
        return { log, vald: { ticketNo: true, dateStarted: true, description: !!log.description } };
    }

    getState(obj) {
        const newState = { showDialog: true, vald: {}, ctlClass: {}, isLoading: false, log: obj };

        if (obj && !obj.id) {
            newState.log = {
                ticketNo: obj.ticketNo,
                dateStarted: moment(obj.startTime || obj.dateStarted || new Date()).toDate(),
                description: obj.description?.trim() || '',
                allowOverride: obj.allowOverride
            };

            if (obj.parentId) {
                newState.log.parentId = obj.parentId;
            }

            let { timeSpent } = obj;

            if (typeof timeSpent === "number") {
                timeSpent = this.$utils.formatSecs(timeSpent, false, true);
            }

            if (!obj.allowOverride && timeSpent) {
                newState.log.timeSpent = timeSpent;
            }

            if (timeSpent) {
                newState.log.overrideTimeSpent = timeSpent;
            }
            else {
                newState.log.overrideTimeSpent = this.defaultTimeSpent;
                newState.log.allowOverride = true;
            }

            this.validateData(newState.log, newState.vald, newState.ctlClass);
        }

        return newState;
    }

    fillWorklog(worklog, copy) {
        return this.$worklog.getWorklog(worklog).then((d) => {
            if (d.timeSpent) {
                d.timeSpent = d.timeSpent.substring(0, 5);
                if (d.timeSpent === "00:00") {
                    d.timeSpent = null;
                }
            }
            if (d.overrideTimeSpent) {
                d.overrideTimeSpent = d.overrideTimeSpent.substring(0, 5);
                d.allowOverride = true;
            }

            if (copy) {
                this.$analytics.trackEvent("Worklog copy", EventCategory.UserActions, (d.isUploaded ? "Uploaded worklog" : "Pending worklog"));
                delete d.id;
                delete d.isUploaded;
                delete d.worklogId;
                delete d.parentId;
                d.dateStarted = moment(`${(new Date()).format('yyyy/MM/dd')} ${d.dateStarted.format('HH:mm:ss')}`).toDate();
            }
            else {
                this.previousTime = d.dateStarted;
                this.$analytics.trackEvent("Worklog view", EventCategory.UserActions, (d.isUploaded ? "Uploaded worklog" : "Pending worklog"));
            }

            const newState = { log: d, vald: this.state.vald, ctlClass: this.state.ctlClass };
            this.validateData(newState.log, newState.vald, newState.ctlClass);
            this.setState(newState);
            return d;
        });
    }

    // eslint-disable-next-line complexity
    validateData(log, vald, ctlClass) {
        if (log.allowOverride) {
            log.overrideTimeSpent = log.overrideTimeSpent || log.timeSpent || "00:00";
        }

        let validation = true;

        const ticketNo = this.getTicketNo(log);
        validation = (vald.ticketNo = !(!ticketNo || ticketNo.length < 3)) && validation;
        if (this.props.editTracker) {
            const ds = moment(log.dateStarted);
            const startOfDay = moment().startOf('day').toDate();
            validation = (vald.dateStarted = ds.isValid() && ds.isBetween(startOfDay, new Date(), undefined, '[]')) && validation;
        } else {
            validation = (vald.dateStarted = !(!log.dateStarted || log.dateStarted.length < 16)) && validation;
            vald.overrideTimeSpent = (log.allowOverride && log.overrideTimeSpent && log.overrideTimeSpent.length >= 4);
            vald.overrideTimeSpent = vald.overrideTimeSpent && this.$worklog.getTimeSpent(log.overrideTimeSpent) > 0;
            validation = (vald.overrideTimeSpent = vald.overrideTimeSpent || (!log.allowOverride && log.timeSpent && log.timeSpent.length >= 4)) && validation;
        }

        validation = (vald.description = this.minCommentLength < 1 || !(!log.description || log.description.length < this.minCommentLength)) && validation;
        ctlClass.ticketNo = !vald.ticketNo ? 'is-invalid' : 'is-valid';
        ctlClass.dateStarted = !vald.dateStarted ? 'is-invalid' : 'is-valid';
        ctlClass.overrideTimeSpent = !vald.overrideTimeSpent ? 'is-invalid' : 'is-valid';
        ctlClass.description = !vald.description ? 'is-invalid' : 'is-valid';

        return validation;
    }

    saveWorklog = (worklog, vald, upload) => {
        if (!this.validateData(worklog, vald, this.state.ctlClass)) {
            this.$message.warning("Please provide value for all the mandatory fields", "Incomplete worklog details");
            return false;
        }

        this.setState({ isLoading: true });

        if (this.props.editTracker) {
            const { dateStarted, description } = this.state.log;
            this.$wltimer.editTrackerInfo(this.getTicketNo(this.state.log), dateStarted, description).then(this.props.onDone);
        } else {
            this.$worklog.saveWorklog({
                ticketNo: this.getTicketNo(worklog),
                dateStarted: worklog.dateStarted,
                overrideTimeSpent: worklog.overrideTimeSpent,
                description: worklog.description,
                worklogId: worklog.worklogId,
                isUploaded: worklog.isUploaded,
                timeSpent: worklog.timeSpent,
                parentId: worklog.parentId,
                id: worklog.id
            }, upload).then((result) => {
                this.props.onDone(worklog.id > 0 ? { type: GadgetActionType.WorklogModified, edited: result, previousTime: this.previousTime } : { type: GadgetActionType.WorklogModified, added: result });
                this.onHide();
            }, (e) => {
                this.setState({ isLoading: false });

                if (typeof e === "string") {
                    this.$message.error(e);
                } else {
                    if (e.message) {
                        this.$message.error(e.message);
                    }
                }
            });
        }
    };

    getTicketNo(worklog) {
        if (!worklog || !worklog.ticketNo) {
            return null;
        }
        return (typeof worklog.ticketNo === 'string') ? worklog.ticketNo : worklog.ticketNo.value;
    }

    deleteWorklog(log) {
        this.setState({ isLoading: true });
        const prevTicketNo = log.ticketNo;
        log.ticketNo = prevTicketNo.value || prevTicketNo;
        this.$worklog.deleteWorklog(log).then((result) => {
            this.setState({ isLoading: false });
            this.props.onDone({
                type: GadgetActionType.DeletedWorklog, removed: log.id,
                deleted: log.id, deletedObj: log
            });
            this.onHide();
        }, () => { log.ticketNo = prevTicketNo; });
    }

    setValue = (field, value, clear) => {
        let { log, vald, ctlClass } = this.state;

        if (value) {
            log[field] = value;
            if (clear) {
                ctlClass = { ...ctlClass, [field]: '' };
                vald = { ...vald, [field]: true };
            }
        }
        else {
            delete log[field];
        }

        log = { ...log };

        this.setState({ log, vald, ctlClass });
    };

    getFooter() {
        const {
            state: { isLoading, log, vald, uploadImmediately }
        } = this;

        return <>
            {!log.id && <Checkbox checked={uploadImmediately} className="pull-left" label="Upload immediately to Jira" onChange={(chk) => this.setState({ uploadImmediately: chk })} />}
            {log.id > 0 && <Button type="danger" icon="fa fa-trash-o" label="Delete" className="pull-left" disabled={isLoading} onClick={() => this.deleteWorklog(log)} />}
            {log.id > 0 && !log.worklogId && <Button type="success" isLoading={isLoading} icon="fa fa-upload" label="Save & Upload" className="pull-left" disabled={isLoading}
                onClick={() => this.saveWorklog(log, vald, true)} />}
            <Button type="primary" icon="fa fa-save" label="Save" isLoading={isLoading} disabled={isLoading} onClick={() => this.saveWorklog(log, vald, uploadImmediately && !(log.id > 0))} />
            <Button type="secondary" icon="fa fa-times" label="Cancel" onClick={this.onHide} />
        </>;
    }

    formatTs = (val) => val;

    handleKeyPress = (e) => {
        const { ctrlKey, charCode } = e;

        if (ctrlKey && charCode === 13) {
            const {
                isLoading,
                state: { log, vald, uploadImmediately }
            } = this;

            if (!isLoading) {
                this.saveWorklog(log, vald, uploadImmediately && !(log.id > 0));
            }
        }
    };

    render() {
        const {
            minCommentLength,
            state: { log, vald, ctlClass }
        } = this;

        if (!this.state.log) { return 'Loading...'; }

        return super.renderBase(<div className="pad-22" onKeyPress={this.handleKeyPress}>
            <div className="row pad-b">
                <div className="col-sm-3">
                    <strong>Log time</strong>
                </div>
                <div className="p-col-9 col-sm-9">
                    <div className="form-group">
                        <div className={ctlClass.dateStarted}>
                            <DatePicker value={log.dateStarted} showTime={true} onChange={(val) => this.setValue("dateStarted", val)} />
                        </div>
                        <span className={`help-block ${vald.dateStarted ? '' : 'msg-error'}`}>Provide the time you had started the work</span>
                    </div>
                </div>
            </div>

            <div className="row pad-b">
                <div className="col-sm-3">
                    <strong>Ticket no</strong>
                </div>
                <div className="col-sm-9">
                    <IssuePicker value={log.ticketNo} useDisplay={true} className="w-p-100" tabIndex="3"
                        placeholder="Enter the ticket number or start typing the summary to get suggestion"
                        disabled={log.isUploaded} maxLength={20} onPick={(val) => this.setValue("ticketNo", val, true)} />
                    <span className={`help-block ${vald.ticketNo ? '' : 'msg-error'}`}>Provide the ticket no on which you had to log your work</span>
                </div>
            </div>

            {!this.props.editTracker && <div className="row pad-b">
                <div className="col-sm-3">
                    <strong>Actual time spent</strong>
                </div>
                <div className="col-sm-2">
                    <strong>{this.formatTs(log.timeSpent) || '-'}</strong>
                </div>
                <div className="col-sm-4">
                    <strong>Override time spent</strong>
                </div>
                <div className="col-sm-3">
                    <div className="form-group no-margin">
                        <div className={`p-inputgroup ${ctlClass.overrideTimeSpent}`}>
                            <span className="p-inputgroup-addon">
                                <Checkbox checked={log.allowOverride || false} onChange={(val) => this.setValue("allowOverride", val)} />
                            </span>
                            <InputMask mask="99:99" className="w-80" value={log.overrideTimeSpent || ""} placeholder="00:00" maxlength={5} disabled={!log.allowOverride}
                                onChange={(e) => this.setValue("overrideTimeSpent", e.value)} />
                        </div>
                    </div>
                </div>
                <div className="col-sm-3"></div>
                <div className="col-sm-9 no-t-padding">
                    <span className={`help-block ${vald.overrideTimeSpent ? '' : 'msg-error'}`}>
                        Provide the time spent on this task (override to change existing)</span>
                </div>
            </div>}

            <div className="row">
                <div className="col-sm-3">
                    <strong>Comments</strong>
                </div>
                <div className="col-sm-9">
                    <TextBox multiline={true} rows={5} value={log.description || ""} className={`form-control ${vald.description ? '' : 'ctl-error'}`}
                        onChange={(val) => this.setValue("description", val)}
                        placeholder={`Provide a brief info about the task you had done.${minCommentLength
                            ? ` Should be atleast ${minCommentLength} chars is length. You can change this settings from General settings -> Worklog tab` : ''}`} />
                </div>
            </div>
        </div>
        );
    }
}

export default AddWorklog;