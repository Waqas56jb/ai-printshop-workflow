import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as customersService from './customers.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await customersService.listCustomers(req.query);
  return sendOk(res, result, 'Customers retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const customer = await customersService.createCustomer(req.body, req.user.id);
  return sendCreated(res, customer, 'Customer created');
});

export const stats = asyncHandler(async (_req, res) => {
  const data = await customersService.getCustomerStats();
  return sendOk(res, data, 'Customer stats retrieved');
});

export const getById = asyncHandler(async (req, res) => {
  const customer = await customersService.getCustomerDetail(req.params.id);
  return sendOk(res, customer, 'Customer retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const customer = await customersService.updateCustomer(req.params.id, req.body);
  return sendOk(res, customer, 'Customer updated');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await customersService.deleteCustomer(req.params.id);
  return sendOk(res, result, 'Customer deleted');
});
