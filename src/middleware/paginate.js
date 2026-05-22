const paginate = (model) => async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
};

const paginateResult = (data, total, page, limit) => ({
  data,
  pagination: {
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  }
});

module.exports = { paginate, paginateResult };
